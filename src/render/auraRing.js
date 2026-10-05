// @ts-check
// WB9g (2026-09-30, Mac: "a new addition (the aura), an animated burning ground aura that circles the ground where your
// character stands. These items should be expensive and sought after"): DAGON'S FIRE, DRAWN - the Sigil Broker's aura,
// burning on the ground about the feet of whoever wears it: a ring of fire that chases itself round, tongues of flame
// licking up out of it, embers circling in it and a glow in the stone inside it. Design: bible/11-Multiplayer/
// World-Bosses.md section 14 (WB9g); the aura's law (who wears one, signed into the token) is net/insignia.js.
//
// TWO DRAWS A WEARER, one pass:
//   - THE GROUND: one quad flat under the feet, the ring, its fire, its embers and the glow inside it answered per pixel
//     from the polar distance and angle about the wearer (a ring band broken by value-noise fire that flows round it,
//     bright crests chasing about it, ten embers orbiting in it, a soft ember-glow within).
//   - THE FLAMES: a low cylinder of flame at the ring - tongues rising out of noise that scrolls up and round, white-hot
//     at the root, orange, red and gone at the top; both faces, so the far side burns behind the wearer too.
//
// The duel wall's law (render/duelWall.js): fixed geometry (a quad, a strip of the cylinder's steps) placed by uniforms;
// added onto the frame (ONE, ONE); tested against the depth the world wrote and never writing it; the ground lifted and
// offset off the stone it lies on; fogged to the frame's fog; every rate whole over the wrapped clock (AURA_CLOCK_PERIOD).
// The travel view draws none (the hosts draw it in the walking views alone). Pure where it can be: `auraWearers` (who is
// drawn, nearest first, at most AURA_DRAW_MAX) and `auraClock` are the pins' doors.
//
// AEGIS (2026-10-03, the owner: "For the account named Sureme ... a title, glyph and new custom aura for this user.
// Title: Aegis of Oblivion. Theme: Purple"; Sureme, sending two Path of Exile ground marks: "i want one that is a full
// circle", "but with some stuff like this one"): THE OBLIVION WARD, the second aura, drawn by the SAME pass - one program,
// the aura picked per wearer by `uAura` (AURA_LOOK: its kind, its ring's radius, its wall's height), so a frame with both
// auras in it is still one program bound once. Not fire but script, in the Aegis of Oblivion's violets:
//   - THE GROUND: the ward's ring WHOLE (the first reference) - one line of light, lilac-white at its heart and violet
//     round it, breathing, two scribes of brighter light running round it; a bezel of fine ticks outside it turning
//     the other way; within it a ring of WARD_RUNES runes in the second reference's script - each a baseline along the
//     ring with a bead or a serif at each end, beads on the line, a comb or a chevron outward, a cross inward
//     (WARD_SCRIPT says which) - turning slowly against the ring and lit one after another as if being written;
//     WARD_SIGILS claws hung inward from the ring at the diagonals (the first reference's four marks); the abyss's
//     violet mist turning within; drawn round from behind the wearer as it kindles.
//   - THE WALL: a veil of light no higher than the shins, in streaks that climb, and WARD_MOTES motes rising off the
//     ring at their own places and paces - so it stands up off the ground seen from the side, as the fire's flames do.
//   - THE SYMBOLS (the owner, after: "Can you add like symbols that float and dissipate"): WARD_GLYPHS cards, each a rune
//     of the script stood on end, lifting off the ring and floating up to the chest - swaying, drifting outward, turning
//     a little, always facing the eye round the vertical - while they blur, break into dust and fade; then each lifts
//     again somewhere else round the ring, another rune. A third draw, the ward's alone.
// Every rate whole over the clock, as the fire's (wardRatesWhole); every pattern round the ring a whole number of
// itself, so no seam behind the wearer.
//
// PRIMARCH (2026-10-04, GA00250, relayed by the owner: "can the aura be a golden light around the character? like i've
// seen some rare mobs with it" - the elite foes' glow, systems/hitFlash.js ELITE_GLOW_GLSL: a warmth, an edge of light
// round the silhouette and embers rising off it): THE GOLDEN RADIANCE, the third aura, the same pass's third look. Not a
// mark on the ground but LIGHT ABOUT THE BODY:
//   - THE WALL: a column of golden light the body's own width (RADIANCE_R) standing past the crown (RADIANCE_H), lit as
//     a glowing shell is - faint where it crosses the body (the eye looks straight through it) and brightest at its two
//     edges, where the eye looks along it, so it reads as light ROUND the wearer, a halo up the silhouette, and never as
//     a gold wash over them; shafts in it climbing, fading toward the top, breathing; RADIANCE_MOTES golden motes rising
//     the column's height at their own places and paces, the elite's embers. From inside it (the wearer's own first
//     person) the column is not drawn - only its motes, dimmer - so the wearer's own view is never veiled in gold.
//   - THE GROUND: the light the column throws - a pool, brightest at the feet; a white-gold ring at the column's foot;
//     RADIANCE_RAYS rays out across the pool, turning slowly.
// It kindles UP: the ground lights as the fire's does, and the column rises from the feet to past the crown. Every rate
// whole over the clock (radianceRatesWhole). No third draw.
//
// SHADOW-CLOAK (2026-10-04, Mac, for SirMcMobdon: "A holo shadow cloak with red accents. Extremely detailed"; then "less
// digital, adjust hood since it's at a weird orientation, not as tall, more cape like, change the floating elements to
// be more emblem like", "For the emblems have it use that user's glyph", "when the user transforms into a werewolf have
// this rip apart with fragments floating around"): THE HOLO SHADOW CLOAK, the fourth look - a CAPE ON THE BODY in the
// Shadow Fang's black and crimson, its hood up:
//   - THE WALL is its own mesh (auraCloakGrid), shaped in the vertex half round the wearer's facing (`uYaw`): hung from
//     the shoulders, clasped at the throat, open below it, flaring and trailing longest down the back, the hood round
//     the head. It SHADES - drawn premultiplied (AURA_LOOK `shade`) so it darkens what is behind it - and its two sides
//     are two draws (`uSide`) culled by the bent mesh's own winding, its lining before its outside. A dense shadow
//     outside, a red lining, a mantle, embroidery down its opening, a hem fraying into smoke.
//   - THE EMBLEM is the wearer's own glyph: the badge's path (ui/playerBadge.js GLYPH_PATH.shadowfang) cut into edges
//     (glyphEdges) and filled in the shader - on its back, as its clasp, and on the THIRD DRAW's cards rising off it.
//   - THE GROUND: a pool of shadow under it.
//   - TORN when its wearer turns beast (`uTorn`, auraBeastStep): it splits and goes, and the third draw's cards past
//     the emblems are its shreds, floating round the beast.
//   - IT MOVES WITH THE BODY (Mac: "Tie the cape to animations"): the pose off the body's posed bones as it was drawn
//     (auraCapePose: `uCapeS` the shoulders, `uCapeH` the head, `uKneeL`/`uKneeR` the knees - fpArm.thirdBones mine,
//     peerBodies.bonesOf a peer's), and a swing off how the wearer moves (auraMotionStep, a damped spring: `uSwing`).
// Every rate whole over the clock (cloakRatesWhole). The pass draws its wearers farthest first (AUDIT).
//
// SERAPH-WINGS (2026-10-05, Mac: "I want to build an aura for the developers ... Golden Angel wings that flow", from a
// painted angel whose wings are long ribbons of light): THE SERAPH WINGS, the fifth look - WINGS OF LIGHT on the body:
//   - THE WINGS are their own mesh (auraWingsGrid): WING_PLUMES primaries and WING_COVERTS short coverts a side, each a
//     broad strand and two fine ones - ribbons of WING_SEGS segments out of the upper back, turned to the eye. Waves and
//     a flutter run out along each so they FLOW; the fan breathes, and beats every eight seconds (wingBeat). Gold,
//     white-hot at each heart, amber at a frayed edge and tip, light pulsing outward; added whole (no shade), nothing
//     laid over an eye among them. The third draw: sparks streaking out past the tips, and a backlight card behind.
//   - THE GROUND: a faint pool of gold; THE LIGHT on the world: auraWingLights (an aura's light, `aura` - gold).
//   - ON THE BACK: laid along the torso's own axes (auraTorso: `uTorsoU`, `uTorsoF`) from the shoulders (`uCapeS`) - a
//     Morrowind rig's bones, or a Beholder sprite's figure (auraSpriteBones, EOTB_FIGURE: by the pixel, the sprite's own
//     facing; AUDIT 3), or the rest pose (a rider's over the saddle, AURA_SADDLE_M); closed when sunk to the neck. Swung
//     as the cape is (auraMotionStep: `uSwing`); unfurling from the root as they kindle. Every rate whole over the clock
//     (wingRatesWhole).
//   - WINGS-FIT (2026-10-05, Mac: "the wings should sit farther back on the eye of the beholder skin ... clips on certain
//     rotational directions", "the aura itself is WAY too bright. It really needs to match this and the slimness of the
//     wings", "way to long, too large and overbearing", the same painted angel): a sprite is a FLAT card standing at its
//     feet, square to the eye, so a wing rooted a hand behind its axis stood inside the body's outline and nearer the
//     eye than the card whenever it was seen from a side or a three-quarter, and was laid over the body there, cut off
//     where it passed through the card. A sprite's wings root WING_SPRITE_BACK further back (the pose's
//     `wingBack`, `uWingBack`): a wing crosses the card no nearer the axis, as the eye sees it, than its own depth behind
//     it - past the body's outline. And slim, short and dimmed to the painting: three strands a plume, not five, a third
//     as broad; twelve plumes a side, not fifteen; about six tenths as long; each strand's light about half; the
//     backlight smaller and faint; the pool and the light on the world dimmer.
//
// Not a DFU member. Ledger A (WB).
import { FOG_FACTOR_GLSL } from './labGrass.js';
import { buildProgram } from './glProgram.js';
import { wrapAngle } from '../world/mat4.js';
import { GLYPH_PATH, GLYPH_DETAIL } from '../ui/playerBadge.js';   // SHADOW-CLOAK: the wearer's own glyph, its emblem

/** The ring's radius about the feet (m), the ground quad's half-width, the flames' height, and the ground's lift. */
export const AURA_RING_R = 0.85;
export const AURA_GROUND_R = 1.35;
export const AURA_FLAME_H = 0.62;
export const AURA_LIFT_M = 0.05;
/** The cylinder's steps round (its strip's resolution). */
export const AURA_STEPS = 48;
/** The most auras one frame draws, and the farthest one is drawn from the eye (m) - past it a ring is a few pixels.
 *  AUDIT 3 (2026-10-05, Mac: "Ensure other players can see all auras"): 32 - a crowd at a hub's fountain is more than
 *  sixteen, and the seventeenth wearer within reach was drawn by nobody; a wearer is four draws at most. */
export const AURA_DRAW_MAX = 32;
export const AURA_RANGE_M = 90;
/** The clock every rate is whole over (s): the ring's turn (AURA_TURN_HZ), the fire's flow and the flames' rise. */
export const AURA_CLOCK_PERIOD = 120;
export const AURA_TURN_HZ = 1 / 8;
/** The seconds a wearer's aura takes to kindle when it first stands (or when they first put it on). */
export const AURA_KINDLE_S = 0.8;
/** AUDIT 3: the seconds a peer's aura is remembered unseen (a frame without their pose, a moment concealed or out of the
 *  list) before it is forgotten - so it does not kindle again from nothing every time they blink out for a frame. */
export const AURA_FORGET_S = 2;

/** AEGIS: THE OBLIVION WARD'S MEASURES - the ring's radius (wider than the fire's, as the first reference's circle stands
 *  clear of the feet), the rune ring's within it, the wall's height (a veil to the shins), and how many of each round. */
export const WARD_RING_R = 0.95;
export const WARD_RUNE_R = 0.78;
export const WARD_WALL_H = 0.42;
export const WARD_RUNES = 12;
export const WARD_SIGILS = 4;
export const WARD_TICKS = 48;
export const WARD_MOTES = 14;
/** AEGIS: THE FLOATING SYMBOLS - how many are aloft at once, the seconds a flight lasts (symbol k's is
 *  WARD_GLYPH_LIFE[k mod 3], each dividing AURA_CLOCK_PERIOD so the flights wrap whole with the clock), how high a flight
 *  climbs over the ring (m), and a card's width and height (m) before it grows as it fades. */
export const WARD_GLYPHS = 9;
export const WARD_GLYPH_LIFE = Object.freeze([3, 4, 5]);
export const WARD_GLYPH_RISE = 1.3;
export const WARD_GLYPH_W = 0.16;
export const WARD_GLYPH_H = 0.26;
/** The ward's rates (Hz), each a whole number of cycles over AURA_CLOCK_PERIOD: the runes' turn against the ring (a
 *  turn in 40 s), the bezel's the other way (60 s), the two scribes' run round the ring, the ring's breath, the
 *  writing's pass round the runes, and the slowest mote's rise (the others two and three times it). */
export const WARD_HZ = Object.freeze({ runes: 1 / 40, bezel: 1 / 60, scribe: 1 / 8, pulse: 1 / 4, write: 1 / 6, mote: 1 / 4 });
/** Its flows in lattice cells a second (the mist's turn round the ring, the veil's climb) - whole over the clock too. */
export const WARD_FLOW = Object.freeze({ mist: 0.5, veil: 0.75 });
/** Every ward rate whole over the clock. Pure. */
export const wardRatesWhole = () => [...Object.values(WARD_HZ), ...Object.values(WARD_FLOW)]
  .every((r) => Number.isInteger(Math.round(r * AURA_CLOCK_PERIOD * 1e6) / 1e6));
/** THE WARD'S SCRIPT: rune k's ornaments as bits on its baseline - 1 a bead ends it on the left (else a serif), 2 on the
 *  right, 4 a bead on the line's left half, 8 on its right, 16 a comb outward (else a chevron), 32 a cross inward. The
 *  second reference's marks, twelve runes no two alike, so the ring reads as writing and not as a pattern. */
export const WARD_SCRIPT = Object.freeze([25, 38, 51, 12, 19, 40, 61, 18, 33, 15, 52, 10]);
/** Its light: the ward's violet (the Aegis of Oblivion's own - ui/playerBadge.js OBLIVION_VIOLET), the lilac-white at a
 *  line's heart (OBLIVION_LILAC), and the abyss's violet in the mist (OBLIVION_ABYSS). RGB 0..1. */
export const WARD_RGB = Object.freeze({ violet: Object.freeze([0.698, 0.302, 1]), heart: Object.freeze([0.925, 0.863, 1]), abyss: Object.freeze([0.302, 0.102, 0.58]) });
/** PRIMARCH: THE GOLDEN RADIANCE'S MEASURES - the column's radius about the body (clear of the shoulders, inside the
 *  fire's ring) and its height (past the crown: the walking body is 1.8 m, player/motor.js CAPSULE_HEIGHT), the pool's
 *  reach on the ground (inside the ground quad), the rays round it, the motes up it, and the shafts' lattice cells round
 *  the column. */
export const RADIANCE_R = 0.6;
export const RADIANCE_H = 2.2;
export const RADIANCE_POOL_R = 1.15;
export const RADIANCE_RAYS = 12;
export const RADIANCE_MOTES = 18;
export const RADIANCE_ROUND = 24;
/** Its rates (Hz), each a whole number of cycles over AURA_CLOCK_PERIOD: the light's breath, the rays' turn (a turn in
 *  30 s), and the slowest mote's climb (the others two and three times it); and the shafts' climb in lattice cells a
 *  second. */
export const RADIANCE_HZ = Object.freeze({ pulse: 1 / 4, rays: 1 / 30, mote: 1 / 6 });
export const RADIANCE_FLOW = Object.freeze({ shafts: 0.5 });
/** Every radiance rate whole over the clock. Pure. */
export const radianceRatesWhole = () => [...Object.values(RADIANCE_HZ), ...Object.values(RADIANCE_FLOW)]
  .every((r) => Number.isInteger(Math.round(r * AURA_CLOCK_PERIOD * 1e6) / 1e6));
/** Its light: the gold the column glows in (the elite foe's warmth, a step paler - systems/hitFlash.js ELITE_GOLD
 *  #ffad29), and the white-gold at the ring's heart and in the motes - the Primarch's own light gold (ui/playerBadge.js
 *  PRIMARCH_GOLD, the menu's #d8cfae). RGB 0..1. */
export const RADIANCE_RGB = Object.freeze({ gold: Object.freeze([1, 0.741, 0.278]), heart: Object.freeze([0.847, 0.812, 0.682]) });
/** SHADOW-CLOAK: THE SHADOW CLOAK'S MEASURES (m above the feet; the walking body is 1.8 m, its eye at 1.7 - player/motor.js
 *  CAPSULE_HEIGHT, EYE_HEIGHT). A CAPE hung from the shoulders and clasped at the throat, its hood up: the hood's peak
 *  a hand over the crown, the hood's middle at the eye, the neck the cape draws in to over the shoulders, the clasp, and
 *  the shoulders it hangs from. */
export const CLOAK_H = 1.88;
export const CLOAK_HOOD_Y = 1.68;
export const CLOAK_NECK_Y = 1.53;
export const CLOAK_CLASP_Y = 1.43;
export const CLOAK_SHOULDER_Y = 1.42;
/** Its radius about the body: across the shoulders, at the hem, round the neck and round the hood; how much further out
 *  than its sides its back hangs at the hem; how far behind the body's middle the hood sits (the face forward of the
 *  head's middle), and how much further back its peak falls. */
export const CLOAK_SHOULDER_R = 0.27;
export const CLOAK_HEM_R = 0.4;
export const CLOAK_NECK_R = 0.15;
export const CLOAK_HOOD_R = 0.165;
export const CLOAK_BACK_M = 0.14;
export const CLOAK_HOOD_BACK_M = 0.035;
export const CLOAK_PEAK_BACK_M = 0.05;
/** The hem's height down the back (a cape trails longest there) and at its front edges. */
export const CLOAK_HEM_Y = Object.freeze({ back: 0.1, edge: 0.26 });
/** How much narrower front to back than across it is: at the shoulders (a body is broader than it is deep) and at the
 *  hem, where the cloth has fallen round; and round the hood, narrower across than deep (as a head is). The folds' depth
 *  (m) at the hem. The mesh's steps round and up. */
export const CLOAK_SQUASH = Object.freeze({ shoulder: 0.32, hem: 0.1, hood: 0.1 });
export const CLOAK_FOLD_M = 0.022;
export const CLOAK_ROUND = 48;
export const CLOAK_ROWS = 48;
/** Its opening at the front, half its width in turns: at the hem and at the chest - closing from there to the clasp,
 *  where its edges meet - and the hood's face at its widest; the face's middle (m up) and half its height. */
export const CLOAK_OPEN = Object.freeze({ hem: 0.2, chest: 0.13, face: 0.12 });
export const CLOAK_FACE = Object.freeze({ y: 1.665, h: 0.135 });
/** Its pattern counts round the body (each a whole number, so the cape closes on itself): the folds and the mantle's
 *  scallops. The mantle over the shoulders: its edge's height. */
export const CLOAK_FOLDS = 14;
export const CLOAK_SCALLOPS = 16;
export const CLOAK_MANTLE_Y = 1.2;
/** The embroidery along its opening and the hood's face, a band of wolf's teeth: the band's width in from the edge and a tooth's
 *  length along it (m). */
export const CLOAK_TRIM = Object.freeze({ band: 0.034, tooth: 0.045 });
/** On the ground: the shadow's pool. */
export const CLOAK_POOL_R = 0.85;
/** THE EMBLEM: the wearer's own glyph - SirMcMobdon's, the Shadow Fang's wolf's head (ui/playerBadge.js GLYPH_PATH
 *  and its eye, GLYPH_DETAIL), the very path the badge draws - on a disc of shadow ringed in crimson. On the cape's back
 *  (its middle's height and its disc's radius, m) and at the clasp (its disc's). */
export const CLOAK_GLYPH = GLYPH_PATH.shadowfang;
export const CLOAK_GLYPH_EYE = GLYPH_DETAIL.shadowfang.path;
export const CLOAK_SIGIL_Y = 0.98;
export const CLOAK_SIGIL_R = 0.15;
export const CLOAK_CLASP_R = 0.04;
/** THE EMBLEMS, its third draw: the emblem rising off its back, turning a little as it climbs, drawn in out of smoke and
 *  falling back to smoke - how many at once, the seconds one lasts (emblem k's is CLOAK_EMBLEM_LIFE[k mod 3], each
 *  dividing AURA_CLOCK_PERIOD), how high one climbs (m) and its card, square (m). */
export const CLOAK_EMBLEMS = 5;
export const CLOAK_EMBLEM_LIFE = Object.freeze([5, 6, 8]);
export const CLOAK_EMBLEM_RISE = 0.75;
export const CLOAK_EMBLEM_M = 0.22;
/** THE BEAST FORM: the wearer turned lycanthrope tears the cloak apart - the seconds the tear takes - and its shreds
 *  float round the beast, drawn with the emblems' cards: how many, a shred's card (m), the radii and heights they float
 *  at (m), and their rates (Hz, each whole over the clock - a shred goes round at one to three times `orbit`, either
 *  way, and turns in its own plane at one or two times `spin`). */
export const CLOAK_RIP_S = 1.2;
export const CLOAK_SHREDS = 14;
export const CLOAK_SHRED_M = 0.17;
export const CLOAK_SHRED_AT = Object.freeze({ r: Object.freeze([0.7, 1.15]), y: Object.freeze([0.3, 2.1]) });
export const CLOAK_SHRED_HZ = Object.freeze({ orbit: 1 / 60, spin: 1 / 10, tumble: 1 / 6, bob: 1 / 5 });
/** Its rates (Hz), each a whole number of cycles over AURA_CLOCK_PERIOD: the cape's billow and the wave running down
 *  it, and the breath of its light. */
export const CLOAK_HZ = Object.freeze({ billow: 1 / 5, wave: 1 / 3, pulse: 1 / 4 });
/** Its flows in lattice cells a second: the smoke stirring in the cloth and falling off its hem, the ground's mist drawn
 *  in and turning. */
export const CLOAK_FLOW = Object.freeze({ smoke: 0.25, hem: 0.5, mist: 0.25, swirl: 0.1 });
/** Every cloak rate whole over the clock. Pure. */
export const cloakRatesWhole = () => [...Object.values(CLOAK_HZ), ...Object.values(CLOAK_FLOW), ...Object.values(CLOAK_SHRED_HZ)]
  .every((r) => Number.isInteger(Math.round(r * AURA_CLOCK_PERIOD * 1e6) / 1e6));
/** Its colours: the Shadow Fang's crimson (ui/playerBadge.js TITLE_GRADIENT.shadowfang's end, #d3193c), an ember's red
 *  for where it burns brightest, the shadow's own black (the gradient's start, #0d0709) and the lining's deep red - the
 *  cloth is shadow, lined and edged in red. RGB 0..1. */
export const CLOAK_RGB = Object.freeze({ crimson: Object.freeze([0.827, 0.098, 0.235]), ember: Object.freeze([1, 0.36, 0.28]), shadow: Object.freeze([0.051, 0.027, 0.035]), lining: Object.freeze([0.32, 0.02, 0.06]) });

/** SHADOW-CLOAK: how near the hood's middle an eye stands inside the cloak (m): its cloth answers nothing there (the
 *  wearer's own first person) and is not drawn, fading in over the next 0.15 m out. */
export const CLOAK_INSIDE_M = 0.3;

/** SERAPH-WINGS: THE WINGS' MEASURES. Plumes a side - the long primaries and, inside them, the short coverts that give
 *  a wing its body - strands a plume (a broad one and two fine about it - WINGS-FIT, were four), and segments along a strand (each a whole
 *  number: the mesh is these counts). */
export const WING_PLUMES = 8;   // WINGS-FIT: 8 / 4 / 3 (were 9 / 6 / 5) - slim, apart tendrils as the painting's, not a sheet
export const WING_COVERTS = 4;
export const WING_STRANDS = 3;
export const WING_SEGS = 32;
/** Where a wing grows from, about the shoulders' middle along the torso (m): behind it, below it, either side of the
 *  spine. */
export const WING_ROOT = Object.freeze({ back: 0.12, below: 0.04, apart: 0.07 });
/** WINGS-FIT: how much further back a Beholder sprite's wings root (m, at the sets' standing scale): its body is a flat
 *  card through its feet, square to the eye, so a wing passes through the card wherever the eye sees it cross - never
 *  nearer the axis, on the screen, than its own depth behind the axis. From this far back that is past the body's
 *  outline (the sets' bodies stand about 0.25 m either side of the axis), so no wing is laid over the body it grows from
 *  as the sprite is seen from round about. */
export const WING_SPRITE_BACK = 0.25;
/** The primaries' fan: the lowest plume's angle and the highest's (rad, from level, outward), and the shortest plume's
 *  reach and the longest's (m) - the high plumes long, the low ones short, as a wing's are. The coverts', inside them. */
export const WING_SPREAD = Object.freeze([-0.7, 1.25]);
export const WING_REACH = Object.freeze([0.6, 1.3]);   // WINGS-FIT: about six tenths (were 0.95 - 2.2 m, a span of four metres over a two-metre body)
export const WING_COVERT = Object.freeze({ spread: Object.freeze([-0.35, 1.0]), reach: Object.freeze([0.28, 0.5]) });   // WINGS-FIT: were 0.45 - 0.8
/** A strand's width at its broadest (m) - the broad strand's taking its glow's sheath - and the fine's. WINGS-FIT: a third
 *  of what they were (0.34, 0.08) - slim ribbons. */
export const WING_W = Object.freeze({ broad: 0.12, fine: 0.035 });
/** The wings' rates (Hz), each whole over the clock: the light running out along a strand, the waves along it, the fan's
 *  breath, every strand's flutter, the wings' beat and the backlight's rays turning. */
export const WING_HZ = Object.freeze({ flow: 1 / 3, wave: 1 / 4, breathe: 1 / 6, flutter: 1 / 2, beat: 1 / 8, rays: 1 / 30 });
/** The beat's stroke: how far down the fan sweeps (rad) and how far forward its tips (a share of their reach). */
export const WING_BEAT = Object.freeze({ down: 0.32, forward: 0.35 });
/** The noise the light runs on: its cells along a strand and how many it scrolls out a second (whole over the clock). */
export const WING_FLOW = Object.freeze({ cells: 8, rate: 0.5, fray: 1.5 });
/** The sparks: how many, their width and length (m) and their lives (s, each dividing the clock). */
export const WING_MOTES = 24;
export const WING_MOTE_M = 0.04;   // WINGS-FIT: smaller with the wings (were 0.05, 0.26)
export const WING_MOTE_LEN = 0.18;
export const WING_MOTE_LIFE = Object.freeze([3, 4, 5]);
/** The backlight: the card of radiance behind the upper back (m across). WINGS-FIT: 1.2 (was 2.6) - a glow behind the
 *  shoulders and head, not a sun behind the wearer. */
export const WING_HALO_M = 1.2;
/** AUDIT 4: the eye's distance from the backlight's middle over which it fades in (m) - gone from the wearer's own first
 *  person (about 0.36 m), whole from a third-person camera's and a peer's at arm's length. */
export const WING_HALO_NEAR = Object.freeze([0.9, 1.6]);
/** The ground's pool of light (m). */
export const WING_POOL_R = 1.0;   // WINGS-FIT: under the shorter wings (was 1.3)
/** Its colours: white-hot at a strand's heart, gold through it, amber at its fraying edge. */
export const WING_RGB = Object.freeze({ core: Object.freeze([1, 0.96, 0.84]), gold: Object.freeze([1, 0.76, 0.32]), amber: Object.freeze([0.95, 0.5, 0.14]) });
/** The strands a side and in all, the mesh's vertices, and the third draw's cards (the sparks and the backlight). */
export const WING_PER_SIDE = (WING_PLUMES + WING_COVERTS) * WING_STRANDS;
export const WING_STRAND_COUNT = 2 * WING_PER_SIDE;
export const WING_VERTS = WING_STRAND_COUNT * WING_SEGS * 6;
export const WING_CARDS = WING_MOTES + 1;
/** Every rate the wings take is whole over the clock, and every spark's life divides it. Pure. */
export const wingRatesWhole = () => [...Object.values(WING_HZ), WING_FLOW.rate, WING_FLOW.fray].every((hz) => Number.isInteger(Math.round(hz * AURA_CLOCK_PERIOD * 1e6) / 1e6))
  && WING_MOTE_LIFE.every((l) => Number.isInteger(AURA_CLOCK_PERIOD / l));

/** AEGIS: HOW EACH AURA IS DRAWN - its kind in the shader (`uAura`), its ring's radius, its wall's height and how many
 *  symbols float off it (the third draw - none for the fire). A pin walks AURAS and requires one each. SHADOW-CLOAK: and,
 *  for the cloak alone, the mesh its wall is (`mesh` - the shaped cloth, not the strip) and that it SHADES: it darkens
 *  what is behind it as well as lighting it, drawn premultiplied (ONE, ONE_MINUS_SRC_ALPHA) where the others add. */
export const AURA_LOOK = Object.freeze({
  dagonfire: Object.freeze({ kind: 0, ringR: AURA_RING_R, flameH: AURA_FLAME_H, glyphs: 0 }),
  oblivionward: Object.freeze({ kind: 1, ringR: WARD_RING_R, flameH: WARD_WALL_H, glyphs: WARD_GLYPHS }),   // and its floating symbols
  radiance: Object.freeze({ kind: 2, ringR: RADIANCE_R, flameH: RADIANCE_H, glyphs: 0 }),   // PRIMARCH: the column about the body
  shadowcloak: Object.freeze({ kind: 3, ringR: CLOAK_HEM_R, flameH: CLOAK_H, glyphs: CLOAK_EMBLEMS, shreds: CLOAK_SHREDS, mesh: 'cloak', shade: true }),   // SHADOW-CLOAK: the cape on the body, its emblems, and its shreds when it tears
  seraphwings: Object.freeze({ kind: 4, ringR: WING_POOL_R, flameH: WING_REACH[1], glyphs: WING_CARDS, mesh: 'wings' }),   // SERAPH-WINGS: the wings on the body, their sparks and their backlight
});
/** The look a wearer's aura is drawn with - Dagon's Fire for one that names none (the fire was the only aura before). */
export const auraLookOf = (aura) => (typeof aura === 'string' && Object.hasOwn(AURA_LOOK, aura) ? AURA_LOOK[aura] : AURA_LOOK.dagonfire);

/** The clock, wrapped: whole cycles of every rate over its period, so no stutter at the wrap. Pure. */
export const auraClock = (seconds) => ((seconds % AURA_CLOCK_PERIOD) + AURA_CLOCK_PERIOD) % AURA_CLOCK_PERIOD;

/**
 * WHO IS DRAWN THIS FRAME: of `wearers` (`[{ id, at: [x, y, z] their feet in the scene, aura }]`), those wearing an
 * aura within AURA_RANGE_M of `eye`, nearest first, at most AURA_DRAW_MAX - written into `out` (one list, refilled: AUDIT
 * WB D10's law) and answered. Pure.
 * @param {Array<{ id?: any, at: number[], aura: string|null, _d2?: number }>} wearers @param {number[]} eye @param {any[]} out
 */
export function auraWearers(wearers, eye, out) {
  out.length = 0;
  if (!Array.isArray(wearers) || !eye) return out;
  const r2 = AURA_RANGE_M * AURA_RANGE_M;
  for (const w of wearers) {
    if (!w || !w.aura || !Array.isArray(w.at)) continue;
    const dx = w.at[0] - eye[0], dy = w.at[1] - eye[1], dz = w.at[2] - eye[2];
    const d2 = dx * dx + dy * dy + dz * dz;
    if (!(d2 <= r2)) continue;
    w._d2 = d2;
    out.push(w);
  }
  out.sort((a, b) => a._d2 - b._d2);
  if (out.length > AURA_DRAW_MAX) out.length = AURA_DRAW_MAX;
  return out;
}

const HEAD = `#version 300 es
precision highp float;
precision highp int;
`;
/** THE FIRE'S NOISE, PERIODIC: value noise on a lattice that wraps at `per` (both whole), so a flow scrolled by the clock
 *  meets itself at the clock's wrap and the angle's noise meets itself where the ring closes - no pop every
 *  AURA_CLOCK_PERIOD, no seam behind the wearer. Each octave doubles the lattice and its period together. */
const NOISE_GLSL = `
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoiseP(vec2 p, vec2 per) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  vec2 i0 = mod(i, per), i1 = mod(i + 1.0, per);
  return mix(mix(h21(i0), h21(vec2(i1.x, i0.y)), u.x), mix(h21(vec2(i0.x, i1.y)), h21(i1), u.x), u.y);
}
float fbmP(vec2 p, vec2 per) { float s = 0.0, a = 0.5; for (int k = 0; k < 4; k++) { s += a * vnoiseP(p, per); p *= 2.0; per *= 2.0; a *= 0.5; } return s; }
// Dagon's fire, by heat (0 cold .. 1 white): the coal's crimson, the fire's orange, the ember's gold, white at the heart
vec3 fireRamp(float v) {
  vec3 c = mix(vec3(0.30, 0.015, 0.01), vec3(0.95, 0.20, 0.03), smoothstep(0.10, 0.45, v));
  c = mix(c, vec3(1.0, 0.62, 0.12), smoothstep(0.45, 0.75, v));
  return mix(c, vec3(1.0, 0.95, 0.78), smoothstep(0.82, 1.0, v));
}
`;
/** The fire's rates, each a whole number of lattice cells over AURA_CLOCK_PERIOD (the ground's flow outward, the
 *  flames' rise and their flicker's), and the lattice's cells round the ring (the ground's, the flames' two). */
export const AURA_FLOW = Object.freeze({ ground: 1.75, rise: 2.4, flicker: 4.8 });
export const AURA_ROUND = Object.freeze({ ground: 18, flames: 26, flicker: 60 });
/** The wrap is whole for every flow: its cells over the clock's period are a whole number. Pure. */
export const auraFlowsWhole = () => Object.values(AURA_FLOW).every((r) => Number.isInteger(Math.round(r * AURA_CLOCK_PERIOD * 1e6) / 1e6));
const v3 = (c) => `vec3(${c.map((x) => x.toFixed(3)).join(', ')})`;
/** A rate (Hz) as GLSL writes it EXACTLY - a division by a whole period where it has one, else its own decimal - never a
 *  rounded one, which drifts off whole by its rounding times the clock and steps the picture at the wrap. */
const hzGlsl = (hz) => { const per = Math.round(1 / hz); return Math.abs(per * hz - 1) < 1e-12 ? `/ ${per.toFixed(1)}` : `* ${hz}`; };
/** AEGIS: A FLOATING SYMBOL'S FLIGHT - symbol k at the clock `t`: where it is about the feet (xyz, m) and its age (w,
 *  0 lifting off the ring .. 1 gone). Each flight lasts its life and the next begins where it ends; which flight it is
 *  wraps with the clock (the lives divide its period), so the wrap is whole. Each flight lifts off a new place round the
 *  ring, sways as it climbs, drifts outward, and slows toward its top. */
const WARD_FLIGHT_GLSL = `
float wardFlightOf(float k, float t) {
  float life = ${WARD_GLYPH_LIFE[0].toFixed(1)} + mod(k, 3.0);
  return mod(floor(t / life + fract(k * 0.618034)), ${AURA_CLOCK_PERIOD.toFixed(1)} / life);
}
vec4 wardFlight(float k, float t) {
  float life = ${WARD_GLYPH_LIFE[0].toFixed(1)} + mod(k, 3.0);
  float age = fract(t / life + fract(k * 0.618034));
  float h = fract(sin((k * 17.0 + wardFlightOf(k, t)) * 12.9898 + 4.1) * 43758.5453);
  float a = h * 6.283185307179586 + 0.35 * sin(age * 3.0 + k);
  float r = uRingR * (0.9 + 0.3 * age);
  float y = uLift + 0.06 + (1.0 - (1.0 - age) * (1.0 - age)) * ${WARD_GLYPH_RISE.toFixed(2)};
  return vec4(cos(a) * r, y, sin(a) * r, age);
}
`;
/** AEGIS: THE OBLIVION WARD'S SCRIPT AND LIGHT - its strokes as distances (m), lit as one inked line is: a lilac-white
 *  heart, a violet body and a soft violet glow round it. */
const WARD_GLSL = `
const vec3 WARD_VIOLET = ${v3(WARD_RGB.violet)};
const vec3 WARD_HEART = ${v3(WARD_RGB.heart)};
const vec3 WARD_ABYSS = ${v3(WARD_RGB.abyss)};
const int WARD_SCRIPT[${WARD_RUNES}] = int[${WARD_RUNES}](${WARD_SCRIPT.join(', ')});
float segD(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
vec3 inked(float d, float w) {
  float heart = 1.0 - smoothstep(w * 0.35, w * 0.7, d);
  float body = 1.0 - smoothstep(w * 0.5, w * 1.15, d);
  float glow = exp(-d * d / (w * w * 9.0));
  return WARD_HEART * heart * 0.9 + WARD_VIOLET * (body * 0.95 + glow * 0.55);
}
// a rune of the script about q (m: along the ring, out from it): its baseline, its two ends, its beads, outward a comb or
// a chevron, inward a cross - by its bits
float runeD(vec2 q, int bits) {
  const float L = 0.13, B = 0.016;
  vec2 le = vec2(-L, 0.0), re = vec2(L, 0.0);
  float d = segD(q, le, re);
  d = min(d, (bits & 1) != 0 ? abs(length(q - le + vec2(B, 0.0)) - B) : segD(q, le - vec2(0.0, 0.03), le + vec2(0.0, 0.03)));
  d = min(d, (bits & 2) != 0 ? abs(length(q - re - vec2(B, 0.0)) - B) : segD(q, re - vec2(0.0, 0.03), re + vec2(0.0, 0.03)));
  if ((bits & 4) != 0) d = min(d, abs(length(q - vec2(-0.06, 0.0)) - 0.015));
  if ((bits & 8) != 0) d = min(d, abs(length(q - vec2(0.06, 0.0)) - 0.015));
  if ((bits & 16) != 0) { for (int i = -1; i <= 1; i++) d = min(d, segD(q, vec2(float(i) * 0.028, 0.012), vec2(float(i) * 0.028, 0.05))); }
  else d = min(d, min(segD(q, vec2(-0.026, 0.014), vec2(0.0, 0.046)), segD(q, vec2(0.0, 0.046), vec2(0.026, 0.014))));
  if ((bits & 32) != 0) d = min(d, min(segD(q, vec2(-0.02, -0.012), vec2(0.02, -0.048)), segD(q, vec2(0.02, -0.012), vec2(-0.02, -0.048))));
  return d;
}
// a claw hung inward from the ring (s: along it, in from it): a stem, and a crescent whose horns curve back to the ring -
// 0.088 m deep at most, clear of the runes' outward strokes (WARD_RUNE_R + 0.05) as they turn beneath it
float sigilD(vec2 s) {
  vec2 c = s - vec2(0.0, 0.05);
  float horns = c.y > 0.0 ? abs(length(c) - 0.038) : length(vec2(abs(c.x) - 0.038, c.y));
  return min(segD(s, vec2(0.0), vec2(0.0, 0.05)), horns);
}
// how much of the ward is drawn yet: round from behind the wearer (the angle's -x) as it kindles, whole once it has
float wardDrawn(float share) { return clamp((uKindle * 1.1 - share) / 0.1, 0.0, 1.0); }
vec3 wardGround(vec2 p) {
  float r = length(p), a = atan(p.y, p.x);
  if (r > uGroundR) discard;
  float R = uRingR;
  float breath = 0.85 + 0.15 * sin(uTime * TAU ${hzGlsl(WARD_HZ.pulse)});
  // THE RING, whole: one line of light, two scribes of brighter light running round it, a halo in the stone about it
  float dr = abs(r - R);
  float scribe = pow(max(0.0, cos(2.0 * a - uTime * TAU ${hzGlsl(2 * WARD_HZ.scribe)})), 24.0);
  vec3 col = inked(dr, 0.016) * (breath + 0.8 * scribe) + WARD_VIOLET * exp(-dr * dr / 0.012) * 0.14;
  // THE BEZEL: ${WARD_TICKS} fine ticks outside it, a longer one every fourth, turning the other way
  float tu = (a + uTime * TAU ${hzGlsl(WARD_HZ.bezel)}) / TAU * ${WARD_TICKS.toFixed(1)};
  float ti = floor(tu + 0.5);
  float rOut = R + 0.07 + (mod(ti, 4.0) < 0.5 ? 0.035 : 0.0);
  float dTick = length(vec2(abs(tu - ti) * TAU / ${WARD_TICKS.toFixed(1)} * r, max(0.0, max(R + 0.035 - r, r - rOut))));
  col += inked(dTick, 0.009) * 0.35;
  // THE RUNES: the script round a ring within it, turning against it, each lit in turn as the writing passes
  float cu = (a - uTime * TAU ${hzGlsl(WARD_HZ.runes)}) / TAU * ${WARD_RUNES.toFixed(1)};
  float k = mod(floor(cu), ${WARD_RUNES.toFixed(1)});
  vec2 q = vec2((fract(cu) - 0.5) * TAU / ${WARD_RUNES.toFixed(1)} * r, r - ${WARD_RUNE_R.toFixed(3)});
  float written = 0.45 + 0.55 * pow(0.5 + 0.5 * cos(uTime * TAU ${hzGlsl(WARD_HZ.write)} - k / ${WARD_RUNES.toFixed(1)} * TAU), 3.0);
  col += inked(runeD(q, WARD_SCRIPT[int(k)]), 0.011) * written;
  // THE CLAWS at the diagonals, hung from the ring
  float su = a / TAU * ${WARD_SIGILS.toFixed(1)};   // a claw at each cell's middle: the diagonals
  col += inked(sigilD(vec2((fract(su) - 0.5) * TAU / ${WARD_SIGILS.toFixed(1)} * r, R - r)), 0.012) * (0.6 + 0.4 * breath);
  // THE ABYSS within: the void's violet mist turning inside the runes, gone under the feet (where the angle's lattice
  // pinches to a point and would draw it as spokes)
  float u = fract(a / TAU);
  float mist = fbmP(vec2(u * 10.0 - uTime * ${WARD_FLOW.mist.toFixed(3)}, r * 3.0), vec2(10.0, 64.0));
  col += WARD_ABYSS * mist * 0.55 * smoothstep(0.08, 0.38, r) * (1.0 - smoothstep(${(WARD_RUNE_R - 0.15).toFixed(3)}, ${(WARD_RUNE_R + 0.02).toFixed(3)}, r));
  return col * wardDrawn(fract(a / TAU + 0.5)) * (1.0 - smoothstep(uGroundR - 0.2, uGroundR, r));
}
// A FLOATING SYMBOL (uv the card's 0..1, s its age, its rune's place in the script, its number): the script's rune stood
// on end, its strokes blurring as it climbs and eaten by its dust from the edges of the noise in, faded in as it lifts off
// and out as it goes
vec3 wardSymbol(vec2 uv, vec3 s) {
  float age = s.x;
  vec2 q = (uv - 0.5) * vec2(${WARD_GLYPH_W.toFixed(2)}, ${WARD_GLYPH_H.toFixed(2)});
  float d = runeD(vec2(q.y, q.x) / 0.75, WARD_SCRIPT[int(s.y + 0.5)]) * 0.75;
  float n = vnoiseP(uv * vec2(7.0, 11.0) + s.z * 3.7, vec2(64.0));
  float whole = smoothstep(age * 1.25 - 0.3, age * 1.25 - 0.1, n);
  float fade = smoothstep(0.0, 0.1, age) * (1.0 - age * age);
  float edge = smoothstep(0.0, 0.12, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
  return inked(d, 0.009 + 0.012 * age) * whole * fade * edge;
}
vec3 wardWall(vec2 q) {
  float u = q.x, v = q.y;
  // THE VEIL: streaks of light standing up off the ring and climbing, gone by the shins
  float n = vnoiseP(vec2(u * 72.0, v * 1.6 - uTime * ${WARD_FLOW.veil.toFixed(3)}), vec2(72.0, ${(WARD_FLOW.veil * AURA_CLOCK_PERIOD).toFixed(1)}));
  vec3 col = WARD_VIOLET * (n * n * n * pow(1.0 - v, 2.2) * 0.55 + exp(-v * 7.0) * 0.18);
  // THE MOTES, rising off the ring each at its own place and pace, dimming as they rise
  float circ = TAU * uRingR;
  for (int m = 0; m < ${WARD_MOTES}; m++) {
    float fm = float(m);
    float h1 = fract(sin(fm * 78.233 + 1.7) * 43758.5453), h2 = fract(sin(fm * 39.425 + 3.1) * 24634.6345);
    float mv = fract(uTime ${hzGlsl(WARD_HZ.mote)} * (1.0 + mod(fm, 3.0)) + h2);
    vec2 dm = vec2((fract(u - h1 + 0.5) - 0.5) * circ, (v - mv) * uFlameH);
    col += (WARD_HEART + WARD_VIOLET) * 0.6 * exp(-dot(dm, dm) / 0.0003) * (1.0 - mv);
  }
  return col * wardDrawn(fract(u + 0.5));
}
`;
/** PRIMARCH: THE GOLDEN RADIANCE'S LIGHT - the column about the body (its wall) and the light it throws on the ground. */
const RADIANCE_GLSL = `
const vec3 RAD_GOLD = ${v3(RADIANCE_RGB.gold)};
const vec3 RAD_HEART = ${v3(RADIANCE_RGB.heart)};
float radianceBreath() { return 0.85 + 0.15 * sin(uTime * TAU ${hzGlsl(RADIANCE_HZ.pulse)}); }
vec3 radianceGround(vec2 p) {
  float r = length(p), a = atan(p.y, p.x);
  if (r > uGroundR) discard;
  float R = uRingR, breath = radianceBreath();
  // THE POOL: the light the column throws, brightest at the feet and gone before the quad's edge
  vec3 col = RAD_GOLD * exp(-r * r / 0.30) * 0.42 * breath;
  // THE RING at the column's foot: a white-gold line in a golden glow
  float dr = r - R;
  col += RAD_GOLD * exp(-dr * dr / 0.0016) * 0.55 * breath + RAD_HEART * exp(-dr * dr / 0.00018) * 0.7;
  // THE RAYS out from the ring across the pool, turning slowly - a whole number round, so no seam behind the wearer
  float ray = pow(0.5 + 0.5 * cos(${RADIANCE_RAYS.toFixed(1)} * (a - uTime * TAU ${hzGlsl(RADIANCE_HZ.rays)})), 8.0);
  col += RAD_GOLD * ray * 0.3 * breath * smoothstep(R * 0.9, R + 0.08, r) * (1.0 - smoothstep(R + 0.15, ${RADIANCE_POOL_R.toFixed(3)}, r));
  return col * (1.0 - smoothstep(uGroundR - 0.2, uGroundR, r));
}
vec3 radianceWall(vec2 q) {
  float u = q.x, v = q.y;
  // A GLOWING SHELL: faint where the eye looks through it (across the body), brightest where it looks along it (the
  // silhouette's two edges) - the horizontal facing of the column's surface to the eye
  float an = u * TAU;
  vec2 e = uCamPos.xz - vWorld.xz;
  float facing = dot(e, e) > 1e-8 ? abs(dot(vec2(cos(an), sin(an)), normalize(e))) : 1.0;
  float rim = 0.14 + 0.86 * pow(1.0 - facing, 2.0);
  // the shafts climbing it, and the column fading toward its top
  float shaft = vnoiseP(vec2(u * ${RADIANCE_ROUND.toFixed(1)}, v * 2.5 - uTime * ${RADIANCE_FLOW.shafts.toFixed(3)}), vec2(${RADIANCE_ROUND.toFixed(1)}, ${(RADIANCE_FLOW.shafts * AURA_CLOCK_PERIOD).toFixed(1)}));
  float rise = (1.0 - smoothstep(0.4, 1.0, v)) * (0.7 + 0.3 * (1.0 - v));   // whole to the chest, gone past the crown
  // never from inside it: the wearer's own first person sees no gold veil, only the motes, dimmer
  float outside = smoothstep(uRingR + 0.1, uRingR + 0.6, length(vec2(length(uCamPos.xz - uAt.xz), max(max(uAt.y - uCamPos.y, uCamPos.y - uAt.y - uFlameH), 0.0))));   // AUDIT 3: out of the column, over or under it too
  vec3 col = RAD_GOLD * rim * rise * (0.35 + 0.65 * shaft * shaft) * 0.75 * radianceBreath() * outside;
  // THE MOTES, rising the column's height each at its own place and pace, kindling off the ground and dimming as they go
  float circ = TAU * uRingR, sparks = 0.0;
  for (int m = 0; m < ${RADIANCE_MOTES}; m++) {
    float fm = float(m);
    float h1 = fract(sin(fm * 63.71 + 2.3) * 43758.5453), h2 = fract(sin(fm * 27.13 + 5.9) * 24634.6345);
    float mv = fract(uTime ${hzGlsl(RADIANCE_HZ.mote)} * (1.0 + mod(fm, 3.0)) + h2);
    vec2 dm = vec2((fract(u - h1 + 0.5) - 0.5) * circ, (v - mv) * uFlameH);
    sparks += exp(-dot(dm, dm) / 0.0005) * (1.0 - mv) * smoothstep(0.0, 0.08, mv);
  }
  col += (RAD_HEART + RAD_GOLD) * 0.55 * sparks * mix(0.35, 1.0, outside);
  // kindled UP: the light rising from the feet
  return col * clamp((uKindle * 1.25 - v) / 0.15, 0.0, 1.0);
}
`;
/** SHADOW-CLOAK: A GLYPH'S OUTLINE AS STRAIGHT EDGES - an SVG path of absolute M, L, Q and Z (ui/playerBadge.js
 *  GLYPH_PATH's shapes), each quadratic cut into `steps` chords and each figure closed, as [ax, ay, bx, by] in the
 *  glyph's own 16-unit box, y down; no edge of no length; any other command refused. Pure. */
export function glyphEdges(path, steps = 4) {
  const tok = String(path).match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)/g) ?? [];
  const out = [];
  let i = 0, cmd = null, at = null, start = null;
  const num = () => { const v = Number(tok[i++]); if (!Number.isFinite(v)) throw new Error(`glyphEdges: a number wanted in ${path}`); return v; };
  const r3 = (x) => Math.round(x * 1000) / 1000;   // as the shader takes it (toFixed(3)) - an edge that rounds to nothing is none
  const edge = (b) => { if (!at) throw new Error(`glyphEdges: a figure must begin with M in ${path}`); if (r3(at[0]) !== r3(b[0]) || r3(at[1]) !== r3(b[1])) out.push([at[0], at[1], b[0], b[1]]); at = b; };
  while (i < tok.length) {
    if (/[A-Za-z]/.test(tok[i])) cmd = tok[i++];
    if (cmd === 'M') { if (start) edge(start); at = [num(), num()]; start = at; cmd = 'L'; }   // pairs after a move are lines
    else if (cmd === 'L') edge([num(), num()]);
    else if (cmd === 'Q') {
      if (!at) throw new Error(`glyphEdges: a figure must begin with M in ${path}`);
      const a = at, c = [num(), num()], b = [num(), num()];
      for (let k = 1; k <= steps; k++) { const t = k / steps, r = 1 - t; edge([r * r * a[0] + 2 * r * t * c[0] + t * t * b[0], r * r * a[1] + 2 * r * t * c[1] + t * t * b[1]]); }
    } else if (cmd === 'Z') { if (start) edge(start); cmd = null; }
    else throw new Error(`glyphEdges: '${cmd}' is not drawn here`);
  }
  if (start) edge(start);   // an open figure closed, to be filled
  return out;
}
const CLOAK_GLYPH_EDGES = glyphEdges(CLOAK_GLYPH), CLOAK_EYE_EDGES = glyphEdges(CLOAK_GLYPH_EYE);
const glyphEdgesGlsl = (name, edges) => `const vec4 ${name}[${edges.length}] = vec4[${edges.length}](${edges.map((e) => `vec4(${e.map((x) => x.toFixed(3)).join(', ')})`).join(', ')});`;
/** SHADOW-CLOAK: THE CLOAK'S SHAPE, both halves' - its frame off the wearer's facing, its radius about the body at a
 *  height, how far behind the body's middle it stands there, and its opening at the front. `u` turns round from the
 *  front's middle (0) by the wearer's right, so the mesh's seam (u 0 = 1) lies inside the opening below the clasp and in
 *  the hood's face, and the collar between them closes whole over it. */
const g1 = (x) => x.toFixed(1), g3 = (x) => x.toFixed(3);
const CLOAK_SHAPE_GLSL = `
const float CLOAK_TAU = 6.283185307179586;
// x squared - never pow(x, 2.0), which GLSL leaves undefined for a negative x (AUDIT: a driver's exp2/log2 answers NaN)
float cloakSq(float x) { return x * x; }
float cloakHash(vec2 p) { p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }
// the wearer's facing: forward is (sin, cos) in x and z (player/motor.js), the right a quarter turn from it
vec2 cloakFwd() { return vec2(sin(uYaw), cos(uYaw)); }
vec2 cloakBearing(float u) { float th = u * CLOAK_TAU; return cloakFwd() * cos(th) + vec2(cos(uYaw), -sin(uYaw)) * sin(th); }
// 0 at the front's middle, 1 down the back
float cloakBackOf(float u) { return 0.5 - 0.5 * cos(u * CLOAK_TAU); }
// where in its folds the cloth is round the body - uneven, so they read as cloth and not as fluting - and the fold
// itself: -1 in a crease .. 1 on a ridge
float cloakFoldPhase(float u) { return u * CLOAK_TAU * ${g1(CLOAK_FOLDS)} + 0.8 * sin(u * CLOAK_TAU * 3.0); }
float cloakFoldOf(float u) { return cos(cloakFoldPhase(u)); }
// how much the cape hangs free at y: none over the shoulders, all of it toward the hem - the folds' depth and the billow
float cloakDrapeOf(float y) { return smoothstep(0.05, 0.9, 1.0 - y / ${g3(CLOAK_SHOULDER_Y)}); }
// the radius about its axis at y (m up) on bearing u: the cape from the shoulders - narrower front to back than across,
// as a body is - falling and flaring to the hem, its back hanging further out; over the shoulders in to the neck; the
// hood round the head, narrower across than deep, closing over the crown
float cloakRadius(float u, float y) {
  float c2 = cloakSq(cos(u * CLOAK_TAU));
  if (y < ${g3(CLOAK_SHOULDER_Y)}) {
    float s = 1.0 - y / ${g3(CLOAK_SHOULDER_Y)};
    float squash = mix(${g3(CLOAK_SQUASH.shoulder)}, ${g3(CLOAK_SQUASH.hem)}, smoothstep(0.0, 0.8, s));
    return mix(${g3(CLOAK_SHOULDER_R)}, ${g3(CLOAK_HEM_R)}, pow(s, 1.3)) * (1.0 - squash * c2) + ${g3(CLOAK_BACK_M)} * cloakBackOf(u) * pow(s, 1.2);
  }
  float across = 1.0 - ${g3(CLOAK_SQUASH.hood)} * (1.0 - c2);
  if (y < ${g3(CLOAK_NECK_Y)}) return mix(${g3(CLOAK_SHOULDER_R)} * (1.0 - ${g3(CLOAK_SQUASH.shoulder)} * c2), ${g3(CLOAK_NECK_R)} * across, smoothstep(${g3(CLOAK_SHOULDER_Y)}, ${g3(CLOAK_NECK_Y)}, y));
  if (y < ${g3(CLOAK_HOOD_Y)}) return mix(${g3(CLOAK_NECK_R)}, ${g3(CLOAK_HOOD_R)}, smoothstep(${g3(CLOAK_NECK_Y)}, ${g3(CLOAK_HOOD_Y)}, y)) * across;
  float s = (y - ${g3(CLOAK_HOOD_Y)}) / ${g3(CLOAK_H - CLOAK_HOOD_Y)};
  return ${g3(CLOAK_HOOD_R)} * across * sqrt(max(0.0, 1.0 - s * s));
}
// how far behind the body's middle its axis stands at y (m): the cape's on the body; the hood's behind the face, its
// peak fallen back a little further
float cloakAxisBack(float y) { return ${g3(CLOAK_HOOD_BACK_M)} * smoothstep(${g3(CLOAK_SHOULDER_Y)}, ${g3(CLOAK_NECK_Y)}, y) + ${g3(CLOAK_PEAK_BACK_M)} * smoothstep(${g3(CLOAK_HOOD_Y)}, ${g3(CLOAK_H)}, y); }
// the opening at the front, half its width in turns: wide at the hem, narrowing up the chest and closed at the clasp
// where its edges meet; the collar whole round the throat; the hood's face open
float cloakOpenHalf(float y) {
  float body = mix(${g3(CLOAK_OPEN.hem)}, ${g3(CLOAK_OPEN.chest)}, smoothstep(0.0, ${g3(CLOAK_CLASP_Y - 0.2)}, y)) * (1.0 - smoothstep(${g3(CLOAK_CLASP_Y - 0.2)}, ${g3(CLOAK_CLASP_Y)}, y));
  float fy = (y - ${g3(CLOAK_FACE.y)}) / ${g3(CLOAK_FACE.h)};
  return max(body, ${g3(CLOAK_OPEN.face)} * sqrt(max(0.0, 1.0 - fy * fy)));
}
// a body-frame offset (x the wearer's right, y their forward, m) in the world's x and z
vec2 cloakWorldXZ(vec2 b) { return vec2(cos(uYaw), -sin(uYaw)) * b.x + cloakFwd() * b.y; }
// how far down its hang a height is: 0 at the shoulders and over them, 1 at the feet
float cloakHangOf(float y) { return clamp(1.0 - y / ${g3(CLOAK_SHOULDER_Y)}, 0.0, 1.0); }
// THE SWING's lag on a turn at y (\`uSwing\` w, rad): the turns its bearing has fallen behind, the more the lower
float cloakTwistAt(float y) { return uSwing.w / CLOAK_TAU * pow(cloakHangOf(y), 1.2); }
// THE TEAR: how far the cloak has torn apart (0 whole .. 1 gone) - \`uTorn\` the seconds since its wearer turned beast,
// negative while they have not
float cloakRipOf() { return uTorn < 0.0 ? 0.0 : clamp(uTorn / ${g3(CLOAK_RIP_S)}, 0.0, 1.0); }
`;
/** SHADOW-CLOAK: THE CLOAK'S CLOTH, ITS GROUND AND ITS EMBLEMS - the fragment half's. Each answers premultiplied: the
 *  light it adds (rgb) and how much of what is behind it the shadow covers (a). */
const CLOAK_FS_GLSL = `
const vec3 CLOAK_CRIMSON = ${v3(CLOAK_RGB.crimson)};
const vec3 CLOAK_EMBER = ${v3(CLOAK_RGB.ember)};
const vec3 CLOAK_SHADOW = ${v3(CLOAK_RGB.shadow)};
const vec3 CLOAK_LINING = ${v3(CLOAK_RGB.lining)};
float cloakBreath() { return 0.85 + 0.15 * sin(uTime * CLOAK_TAU ${hzGlsl(CLOAK_HZ.pulse)}); }
// THE WEARER'S GLYPH (ui/playerBadge.js GLYPH_PATH.shadowfang, SirMcMobdon's wolf's head, and its eye - GLYPH_DETAIL),
// cut into straight edges (glyphEdges) in its own 16-unit box, y down as its path is: the distance to its outline,
// negative inside (even-odd - the badge fills nonzero, the same for a path that never crosses itself, which a pin checks)
${glyphEdgesGlsl('CLOAK_GLYPH_EDGES', CLOAK_GLYPH_EDGES)}
${glyphEdgesGlsl('CLOAK_EYE_EDGES', CLOAK_EYE_EDGES)}
float cloakSeg2(vec2 p, vec4 e) { vec2 ab = e.zw - e.xy, w = p - e.xy; vec2 q = w - ab * clamp(dot(w, ab) / dot(ab, ab), 0.0, 1.0); return dot(q, q); }
float cloakCross(vec2 p, vec4 e) { float c = step(e.y, p.y) - step(e.w, p.y); return c != 0.0 && p.x < e.x + (p.y - e.y) * (e.z - e.x) / (e.w - e.y) ? 1.0 : 0.0; }
float cloakGlyphD(vec2 p) {
  float d = 1e9, n = 0.0;
  for (int i = 0; i < ${CLOAK_GLYPH_EDGES.length}; i++) { d = min(d, cloakSeg2(p, CLOAK_GLYPH_EDGES[i])); n += cloakCross(p, CLOAK_GLYPH_EDGES[i]); }
  return (mod(n, 2.0) > 0.5 ? -1.0 : 1.0) * sqrt(d);
}
float cloakEyeD(vec2 p) {
  float d = 1e9, n = 0.0;
  for (int i = 0; i < ${CLOAK_EYE_EDGES.length}; i++) { d = min(d, cloakSeg2(p, CLOAK_EYE_EDGES[i])); n += cloakCross(p, CLOAK_EYE_EDGES[i]); }
  return (mod(n, 2.0) > 0.5 ? -1.0 : 1.0) * sqrt(d);
}
// THE EMBLEM at p in its own measure (its disc's edge at 1.4, x across to the eye's right, y up; w a pixel's width in
// it): the wearer's glyph filled in crimson deepening down to the mane, its outline lit, its eye an ember; a ring about
// it and a fine ring outside that, on a disc of shadow - the light it gives (rgb) and its disc (a)
vec4 cloakEmblemAt(vec2 p, float w) {
  float l = length(p);
  if (l > 1.45) return vec4(0.0);   // past its disc, no glyph to measure
  vec2 g = vec2(8.0 + p.x * 7.0, 8.0 - p.y * 7.0);   // into the glyph's box: seven of its units to one
  float gd = cloakGlyphD(g) / 7.0;
  float fill = 1.0 - smoothstep(-w, 0.0, gd);
  float ring = 1.0 - smoothstep(0.0, w, abs(l - 1.2) - 0.035);
  float fine = 1.0 - smoothstep(0.0, w, abs(l - 1.33) - 0.014);
  vec3 col = CLOAK_CRIMSON * (fill * mix(0.2, 0.62, smoothstep(-0.9, 0.9, p.y)) + 0.5 * exp(-gd * gd / (w * w * 2.0)) + 0.1 * exp(-max(gd, 0.0) * 14.0) + ring * 0.62 + fine * 0.32);
  col = mix(col, CLOAK_EMBER, (1.0 - smoothstep(-w, 0.0, cloakEyeD(g) / 7.0)) * 0.9);
  return vec4(col * cloakBreath(), 1.0 - smoothstep(1.37, 1.42, l));
}
// THE EMBROIDERY m metres in from an edge, \`along\` it: a line at the edge, a band of wolf's teeth inside it, a fine line
// at the band's inner side
float cloakTrim(float m, float along) {
  if (m < 0.0 || m > ${g3(CLOAK_TRIM.band + 0.012)}) return 0.0;
  float tooth = abs(fract(along / ${g3(CLOAK_TRIM.tooth)}) - 0.5) * 2.0;
  float line = 0.009 + tooth * ${g3(CLOAK_TRIM.band - 0.018)};
  return exp(-cloakSq(m - 0.004) / 0.00001) + 0.7 * exp(-cloakSq(m - line) / 0.00001) + 0.45 * exp(-cloakSq(m - ${g3(CLOAK_TRIM.band)}) / 0.000006);
}
vec4 cloakWall(vec2 q) {
  float u = q.x, v = q.y, y = v * uFlameH, t = uTime;
  // KINDLED: drawn in out of smoke from the hem up - nothing past the line the kindling has reached, embers along it
  float grown = uKindle * 1.25 - 0.1 - v - (vnoiseP(vec2(u * 16.0, y * 5.0), vec2(16.0, 64.0)) - 0.5) * 0.2;
  if (grown < 0.0) discard;
  float r = max(cloakRadius(u, y), 0.04), circ = CLOAK_TAU * r;
  float su = u > 0.5 ? u - 1.0 : u;   // signed round from the front: the wearer's right positive
  // THE CLASP at the throat, where the opening's edges meet - whole over them (seen from the front: its x the eye's right)
  vec2 cp = vec2(-su * circ, y - ${g3(CLOAK_CLASP_Y - 0.012)}) * ${g3(1.4 / CLOAK_CLASP_R)};
  float brooch = 1.0 - smoothstep(1.37, 1.42, length(cp));
  // THE OPENING at the front: metres into the cloth from its edge
  float edgeM = (abs(su) - cloakOpenHalf(y)) * circ;
  if (edgeM < 0.0 && brooch <= 0.0) discard;
  // TORN, when its wearer turns beast: seams opening across it, its pieces gone one after another, embers along every
  // tear - the cells of a warped grid round and up it, twelve round so it closes on itself
  float rip = cloakRipOf(), torn = 0.0;
  if (rip > 0.0) {
    vec2 c = vec2(u * 12.0, y * 6.0) + (vec2(vnoiseP(vec2(u * 24.0, y * 9.0), vec2(24.0, 64.0)), vnoiseP(vec2(u * 24.0 + 7.0, y * 9.0), vec2(24.0, 64.0))) - 0.5) * 0.7;
    vec2 f = fract(c);
    float seam = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)) - rip * 0.3;
    if (seam < 0.0 || cloakHash(vec2(mod(floor(c.x), 12.0), floor(c.y)) + 0.5) < rip * 1.3 - 0.2) discard;
    torn = exp(-seam * seam / 0.0015);
  }
  // the cloth's facing - round the body, bent by its folds, and tilted by its lean in and out as it rises (the hood's
  // top, the shoulders) - against the eye, for its light. ITS TWO SIDES ARE TWO DRAWS (\`uSide\`): its lining (0, the
  // faces turned from the eye, culled to them) laid first and its outside (1) over it, so one row's far cloth never lies
  // over the next row's near - the side the BENT mesh's own winding says (AUDIT: the rest pose's normal misnamed up to a
  // quarter of it posed), so this facing only lights it
  float drape = cloakDrapeOf(y);
  float phase = cloakFoldPhase(u), fold = cos(phase) * drape;
  vec2 bn = cloakBearing(u + 0.02 * sin(phase) * drape + cloakTwistAt(y));
  float lean = (cloakRadius(u, y + 0.01) - cloakRadius(u, y - 0.01)) * 50.0 - (cloakAxisBack(y + 0.01) - cloakAxisBack(y - 0.01)) * 50.0 * dot(cloakFwd(), bn);
  vec3 e = uCamPos - vWorld;
  float toward = dot(normalize(vec3(bn.x, -lean, bn.y)), dot(e, e) > 1e-8 ? normalize(e) : vec3(bn.x, 0.0, bn.y));
  // never from inside it: the wearer's own first person sees no shadow over the view
  vec2 hx = cloakWorldXZ(uCapeH.xz); float outside = smoothstep(${g3(CLOAK_INSIDE_M)}, ${g3(CLOAK_INSIDE_M + 0.15)}, distance(uCamPos, uAt + vec3(hx.x, uCapeH.y, hx.y)));   // by the hood's middle (AUDIT 2)
  float breath = cloakBreath();
  // THE HEM, longest down the back and ragged, its last hand's breadth coming apart into smoke that falls from it
  float hemM = y - mix(${g3(CLOAK_HEM_Y.edge)}, ${g3(CLOAK_HEM_Y.back)}, cloakBackOf(u)) - 0.035 * vnoiseP(vec2(u * 24.0, 0.5), vec2(24.0, 8.0)) - 0.05 * pow(vnoiseP(vec2(u * 9.0, 2.5), vec2(9.0, 8.0)), 3.0);
  float smoke = fbmP(vec2(u * 16.0, y * 3.0 + t * ${g3(CLOAK_FLOW.hem)}), vec2(16.0, ${g1(CLOAK_FLOW.hem * AURA_CLOCK_PERIOD)}));
  float fray = 1.0 - smoothstep(0.0, 0.1, hemM);
  float tear = smoke - fray * 0.8;
  if (edgeM >= 0.0 && (tear < 0.0 || hemM < 0.0)) {
    // what has come apart: smoke trailing off the hem, a hand below it at most, a crimson glow in it
    float trail = smoothstep(0.25, 0.65, smoke) * (1.0 - smoothstep(0.0, 0.12, -hemM)) * 0.55;
    if (trail <= 0.002) discard;
    return vec4(CLOAK_CRIMSON * trail * 0.05 * breath * outside, trail * outside);
  }
  float rim = pow(max(0.0, 1.0 - abs(toward)), 3.0);
  float stir = fbmP(vec2(u * 10.0, y * 2.0 - t * ${g3(CLOAK_FLOW.smoke)}), vec2(10.0, ${g1(CLOAK_FLOW.smoke * AURA_CLOCK_PERIOD)}));
  vec3 col;
  float shade;
  float lit = abs(toward);
  if (uSide == 1) {
    // ITS OUTSIDE: shadow, dense and dark and stirring, the folds' ridges catching a crimson sheen, a crimson rim
    // where it turns away
    shade = 0.86 + 0.08 * rim - 0.1 * stir;
    col = CLOAK_SHADOW * (0.5 + 0.5 * lit) * (0.8 + 0.2 * fold) + CLOAK_CRIMSON * (0.25 * rim + 0.06 * pow(max(fold, 0.0), 3.0) * lit) * breath;
    // THE MANTLE over the shoulders: its scalloped edge stitched in crimson, its shadow on the cape under it
    float me = y - ${g3(CLOAK_MANTLE_Y)} + 0.03 * sin(3.14159265 * fract(u * ${g1(CLOAK_SCALLOPS)}));
    shade += 0.06 * step(0.0, me);
    col *= 1.0 - 0.6 * exp(-cloakSq(me + 0.012) / 0.0001);
    col += CLOAK_CRIMSON * exp(-cloakSq(me - 0.005) / 0.00001) * 0.4 * breath;
    // THE EMBLEM on its back, on a disc of deeper shadow and burning through it (seen from behind: its x the eye's right)
    vec2 sp = vec2((0.5 - u) * circ, y - ${g3(CLOAK_SIGIL_Y)}) * ${g3(1.4 / CLOAK_SIGIL_R)};
    if (length(sp) < 1.45) {
      vec4 em = cloakEmblemAt(sp, 0.04);
      col = col * (1.0 - 0.5 * em.a) + em.rgb * (0.6 + 0.4 * lit);
      shade += 0.08 * em.a;
    }
  } else {
    // ITS LINING, seen through the opening and inside the hood: a deep red, brightest where it faces the eye
    shade = 0.86;
    col = CLOAK_LINING * (0.35 + 0.45 * lit + 0.2 * fold) + CLOAK_CRIMSON * 0.1 * rim * breath;
  }
  // THE EMBROIDERY down its front edges and round the hood's face, where it is open (the hem has none: its last hand's
  // breadth is fraying into smoke, smouldering where it tears - AUDIT: a band there was never seen)
  float trim = cloakTrim(edgeM, y) * step(0.001, cloakOpenHalf(y));
  col += CLOAK_CRIMSON * trim * 0.75 * breath * (uSide == 1 ? 1.0 : 0.6);
  // the hem's tear smouldering where it comes apart
  col += mix(CLOAK_CRIMSON, CLOAK_EMBER, 0.3) * exp(-tear * tear / 0.0008) * fray * 0.4 * breath;
  // THE CLASP: a brooch of the emblem over the meeting edges
  if (brooch > 0.0) {
    vec3 b = CLOAK_SHADOW * 0.5 + cloakEmblemAt(cp, 0.12).rgb * 1.3;
    col = edgeM < 0.0 ? b * brooch : mix(col, b, brooch);
    shade = edgeM < 0.0 ? 0.9 * brooch : mix(shade, 0.9, brooch);
  }
  // the tear's embers
  col += mix(CLOAK_CRIMSON, CLOAK_EMBER, 0.4) * torn * 0.9;
  // kindling, embers along the line it has reached
  col += (CLOAK_EMBER * 0.5 + CLOAK_CRIMSON) * exp(-grown * grown / 0.0006) * (1.0 - smoothstep(0.9, 1.0, uKindle));
  return vec4(col * outside, clamp(shade, 0.0, 0.94) * outside);
}
vec4 cloakGround(vec2 p) {
  float r = length(p);
  if (r > ${g3(CLOAK_POOL_R)}) discard;   // nothing of it past its pool (AUDIT: the quad's outer ring paid for nothing)
  float a = r > 1e-6 ? atan(p.y, p.x) : 0.0;
  float u = fract(a / CLOAK_TAU), t = uTime;
  // THE SHADOW it pools under it, mist turning in it and drawn in toward the feet
  float mist = fbmP(vec2(u * 12.0 + t * ${g3(CLOAK_FLOW.swirl)}, r * 3.0 + t * ${g3(CLOAK_FLOW.mist)}), vec2(12.0, ${g1(CLOAK_FLOW.mist * AURA_CLOCK_PERIOD)}));
  float pool = 1.0 - smoothstep(0.25, ${g3(CLOAK_POOL_R)}, r);
  float shade = pool * (0.5 + 0.35 * mist);
  // a dull crimson in the mist under the hem - the light of its embers on the ground
  float under = exp(-cloakSq(r - ${g3(CLOAK_HEM_R * 0.95)}) / 0.02) * smoothstep(0.5, 0.8, mist) * pool;
  vec3 col = CLOAK_CRIMSON * (pool * pool * 0.05 + under * 0.14) * cloakBreath();
  // KINDLED out from the feet; the quad's edge soft
  float vis = (1.0 - smoothstep(uKindle * 1.4 - 0.1, uKindle * 1.4, r)) * (1.0 - smoothstep(uGroundR - 0.2, uGroundR, r));
  return vec4(col * vis, clamp(shade, 0.0, 0.9) * vis);
}
// AN EMBLEM (uv its card's 0..1, s its age and its number): the wearer's emblem on its disc of shadow, drawn in out of
// smoke as it rises off the back and falling back to smoke at its end, embers where it forms and where it breaks; none
// while the cloak is still forming, and fading as it tears
vec4 cloakEmblem(vec2 uv, vec3 s) {
  vec2 p = (uv - 0.5) * 3.0;   // its measure: the disc's edge at 1.4, the card's at 1.5
  float gate = (1.0 - smoothstep(1.4, 1.5, max(abs(p.x), abs(p.y)))) * smoothstep(0.8, 1.0, uKindle) * (1.0 - cloakRipOf());
  if (gate <= 0.0) return vec4(0.0);   // a card that shows nothing works nothing out
  float life = clamp(min(s.x / 0.2, (1.0 - s.x) / 0.35), 0.0, 1.0);
  float held = life * 1.1 - 0.05 - vnoiseP(p * 2.2 + vec2(s.z * 7.1, s.z * 3.7), vec2(64.0));
  if (held < 0.0) return vec4(0.0);
  float form = smoothstep(0.0, 0.03, held);
  vec4 em = cloakEmblemAt(p, 0.05);
  float ember = exp(-held * held / 0.002) * (1.0 - smoothstep(0.85, 1.0, life)) * em.a;
  return vec4((em.rgb * form * 0.85 + mix(CLOAK_CRIMSON, CLOAK_EMBER, 0.4) * ember * 0.6) * gate, em.a * 0.82 * form * gate);
}
// A SHRED (uv its card's 0..1, s its number): a scrap torn off the cloak - shadow with a ragged edge smouldering crimson,
// some with a strip of the opening's wolf's teeth along them; dimmer from inside their ring (the beast's own eye)
vec4 cloakShred(vec2 uv, vec3 s) {
  vec2 p = (uv - 0.5) * 2.0;
  float h = cloakHash(vec2(s.z, 6.1));
  float shape = 0.74 - max(abs(p.x) * (0.75 + 0.5 * h), abs(p.y)) - (vnoiseP(p * 2.2 + s.z * 5.3, vec2(64.0)) - 0.5) * 0.55 - (vnoiseP(p * 6.0 + s.z * 3.1, vec2(64.0)) - 0.5) * 0.18;
  if (shape < -0.04) return vec4(0.0);
  float inside = smoothstep(-0.02, 0.02, shape);
  float burn = exp(-shape * shape / 0.002);
  float teeth = step(0.5, cloakHash(vec2(s.z, 3.3))) * exp(-cloakSq(p.y + 0.42 - abs(fract(p.x * 2.5) - 0.5) * 0.36) / 0.002) * inside;
  float gate = mix(0.35, 1.0, smoothstep(0.55, 1.0, length(uCamPos.xz - uAt.xz)));
  vec3 col = CLOAK_SHADOW * 0.4 * inside + (mix(CLOAK_CRIMSON, CLOAK_EMBER, 0.35) * burn * 0.7 + CLOAK_CRIMSON * teeth * 0.6) * cloakBreath();
  return vec4(col * gate, inside * 0.85 * gate);
}
`;
/** SHADOW-CLOAK: where the cloak's mesh stands, and its emblems' flights - the vertex half's alone. */
const CLOAK_VS_GLSL = `
// the cape's billow and a wave running down it - most at the hem and down the back, none at the shoulders
float cloakBillow(float u, float y, float t) {
  float th = u * CLOAK_TAU;
  float w = 0.035 * sin(2.0 * th + y * 2.0 + t * CLOAK_TAU ${hzGlsl(CLOAK_HZ.billow)}) + 0.016 * sin(5.0 * th + y * 6.0 + t * CLOAK_TAU ${hzGlsl(CLOAK_HZ.wave)});
  return w * pow(cloakDrapeOf(y), 1.5) * (0.3 + 0.7 * cloakBackOf(u));
}
// A KNEE (k, the body's frame: x right, y up, z forward, m about the feet) pressing the cloth out where a stride carries
// it past - at bearing u, radius r and height y: how far the cloth is pushed out round it
float cloakKneePush(vec3 k, float u, float r, float y) {
  float kr = length(k.xz);
  if (kr < 1e-4) return 0.0;
  return min(0.2, max(0.0, kr + 0.07 - r)) * smoothstep(0.75, 0.97, dot(vec2(sin(u * CLOAK_TAU), cos(u * CLOAK_TAU)), k.xz / kr)) * exp(-cloakSq(y - k.y) / 0.04);   // never more than a hand's tent
}
vec3 cloakPoint(vec2 q, float t) {
  float u = q.x, y = q.y * uFlameH, rip = cloakRipOf(), h = cloakHangOf(y);
  float ut = u + cloakTwistAt(y);   // lagging a turn
  // THE BODY'S POSE: hung from its shoulders where they are (\`uCapeS\`, the body's frame) - scaled between the feet and
  // them, so a crouch or a shorter or taller body carries it, and gathering out as it is pressed down; the collar
  // with the shoulders, and the hood with the head (\`uCapeH\`), turned as the head turns
  float ky = uCapeS.y / ${g3(CLOAK_SHOULDER_Y)};
  float r = cloakRadius(u, y) * mix(uCapeS.w, 1.0, smoothstep(${g3(CLOAK_SHOULDER_Y)}, ${g3(CLOAK_NECK_Y)}, y)) + ${g3(CLOAK_FOLD_M)} * cloakFoldOf(u) * cloakDrapeOf(y) + cloakBillow(u, y, t) + rip * (0.15 + 0.35 * cloakBackOf(u)) + max(0.0, 1.0 - ky) * h * 0.3;   // as broad as the body's shoulders; bursting out as it tears; gathering as it is pressed down
  vec2 d = cloakBearing(ut) * r - cloakFwd() * cloakAxisBack(y);
  float py;
  if (y < ${g3(CLOAK_SHOULDER_Y)}) {
    d += cloakWorldXZ(uCapeS.xz) * (1.0 - 0.5 * h);
    py = y * ky;
  } else {
    float wh = smoothstep(${g3(CLOAK_SHOULDER_Y)}, ${g3(CLOAK_HOOD_Y)}, y), a = uCapeH.w * wh;
    d = vec2(d.x * cos(a) + d.y * sin(a), -d.x * sin(a) + d.y * cos(a));
    vec3 off = mix(vec3(uCapeS.x, uCapeS.y - ${g3(CLOAK_SHOULDER_Y)}, uCapeS.z), vec3(uCapeH.x, uCapeH.y - ${g3(CLOAK_HOOD_Y)}, uCapeH.z), wh);
    d += cloakWorldXZ(off.xz);
    py = y + off.y;
  }
  // THE SWING (\`uSwing\`, auraMotionStep): trailing its wearer's motion, the more the lower, rising as a pendulum does;
  // lifting and filling as they fall
  float hang = ${g3(CLOAK_SHOULDER_Y)} * max(ky, 0.0) * h;   // never negative (AUDIT 2: a pose at the feet)
  vec2 trail = uSwing.xy * pow(h, 1.6) * min(ky, 1.0);   // a crouched hang swings shorter
  float tl = length(trail);
  if (tl > 0.7 * hang) trail *= 0.7 * hang / tl;   // never so far the pendulum folds the hem over itself (AUDIT)
  d += cloakWorldXZ(trail) + cloakBearing(ut) * uSwing.z * h * 0.6;
  py += hang - sqrt(max(hang * hang - dot(trail, trail), 0.0)) + max(uSwing.z, 0.0) * h * h;   // a rise never drops it below the feet
  // never through the legs: below the shoulders the cloth keeps a hand off the body's axis (AUDIT - a strafe's trail)
  float keep = y < ${g3(CLOAK_SHOULDER_Y)} ? mix(0.15, 0.22, h) : 0.0, along = dot(d, cloakBearing(ut));   // out along its own bearing, so neighbours never part across the axis (AUDIT 2)
  if (along < keep) d += cloakBearing(ut) * (keep - along);
  // the knees, where a stride carries one past the cloth
  d += cloakBearing(ut) * (cloakKneePush(uKneeL, ut, r, py) + cloakKneePush(uKneeR, ut, r, py));
  return uAt + vec3(d.x, py + rip * 0.2 * q.y, d.y);
}
// emblem k's life (s): CLOAK_EMBLEM_LIFE[k mod 3]
float cloakEmblemLife(float k) { float m = mod(k, 3.0); return m < 0.5 ? ${g1(CLOAK_EMBLEM_LIFE[0])} : m < 1.5 ? ${g1(CLOAK_EMBLEM_LIFE[1])} : ${g1(CLOAK_EMBLEM_LIFE[2])}; }
// which of emblem k's flights the clock t is in - wrapping with the clock (the lives divide its period)
float cloakEmblemOf(float k, float t) { float life = cloakEmblemLife(k); return mod(floor(t / life + fract(k * 0.618034)), ${g1(AURA_CLOCK_PERIOD)} / life); }
// emblem k at the clock t: where it is about the feet (xyz, m) and its age (w, 0 rising off the back .. 1 gone); each
// flight rises off the back somewhere else between the shoulder blades and the shoulders, drifting out behind
vec4 cloakEmblemFlight(float k, float t) {
  float life = cloakEmblemLife(k);
  float age = fract(t / life + fract(k * 0.618034));
  float n = cloakEmblemOf(k, t);
  float u = 0.5 + (cloakHash(vec2(k * 17.0 + n, 4.1)) - 0.5) * 0.45;
  float y0 = 1.05 + cloakHash(vec2(k * 5.0 + n, 8.3)) * 0.35;
  vec2 d = cloakBearing(u) * (cloakRadius(u, y0) + 0.08 + 0.3 * age) + cloakWorldXZ(uCapeS.xz);   // off the back where the pose has it
  return vec4(d.x, y0 * uCapeS.y / ${g3(CLOAK_SHOULDER_Y)} + (1.0 - (1.0 - age) * (1.0 - age)) * ${g3(CLOAK_EMBLEM_RISE)}, d.y, age);
}
// shred j, \`since\` seconds after the cloak tore: where it is about the feet (xyz, m) - torn off the cape at its own place
// and flung out, then floating round the beast at its own height and pace, either way round, bobbing - and its turn in
// its own plane (w, radians). Every rate whole over the clock, which \`since\` wraps with past the tear (auraBeastStep)
vec4 cloakShredFlight(float j, float since) {
  float u0 = 0.12 + cloakHash(vec2(j, 2.7)) * 0.76;
  float y0 = 0.35 + cloakHash(vec2(j, 5.3)) * 1.0;
  float burst = 1.0 - pow(1.0 - clamp(since / ${g3(CLOAK_RIP_S)}, 0.0, 1.0), 3.0);
  float pace = (1.0 + floor(cloakHash(vec2(j, 9.1)) * 3.0)) * (mod(j, 2.0) < 0.5 ? 1.0 : -1.0);
  float r = mix(cloakRadius(u0, y0), ${g3(CLOAK_SHRED_AT.r[0])} + cloakHash(vec2(j, 7.7)) * ${g3(CLOAK_SHRED_AT.r[1] - CLOAK_SHRED_AT.r[0])}, burst);
  float y = mix(y0, ${g3(CLOAK_SHRED_AT.y[0])} + cloakHash(vec2(j, 1.3)) * ${g3(CLOAK_SHRED_AT.y[1] - CLOAK_SHRED_AT.y[0])}, burst) + 0.07 * burst * sin(since * CLOAK_TAU ${hzGlsl(CLOAK_SHRED_HZ.bob)} + j * 1.7);
  vec2 d = cloakBearing(u0 + since * pace ${hzGlsl(CLOAK_SHRED_HZ.orbit)}) * r;
  return vec4(d.x, y, d.y, since * CLOAK_TAU * (1.0 + floor(cloakHash(vec2(j, 4.4)) * 2.0)) ${hzGlsl(CLOAK_SHRED_HZ.spin)} + j);
}
`;
/** SERAPH-WINGS: what both halves share - the beat: every WING_HZ.beat a slow stroke, down and forward fast and back up
 *  slow, its tips after its roots (`t` how far out, 0 .. 1). */
const WING_SHARED_GLSL = `
float wingBeat(float t, float time) {
  float bp = fract(time ${hzGlsl(WING_HZ.beat)} - 0.06 * t);
  return smoothstep(0.0, 0.18, bp) * (1.0 - smoothstep(0.18, 0.75, bp));
}
`;
/** SERAPH-WINGS: THE WINGS' SHAPE, the vertex half's - a strand's point at its length's share `t` (0 its root, 1 its tip)
 *  in the body's frame (x right, y up, z forward, m about the feet): laid out of the upper back along the TORSO's own
 *  axes (`uTorsoU`, `uTorsoF` - auraCapePose, off the body's spine), so the wings lean and turn as the back does; on a
 *  curve rising behind the shoulder and out along its plume's angle to its reach, the tips drooping; waves running out
 *  along it; the fan breathing and beating; and the body's swing carried the more the further out. */
const WING_VS_GLSL = `
float wingHash(float n) { return fract(sin(n * 78.233 + 1.7) * 43758.5453); }
// strand k: its side (-1 the wearer's left, +1 their right), its plume's place up its fan (0 the lowest .. 1 the
// highest), which of the plume's strands (0 the broad, 1 .. 4 the fine about it) and whether a covert (1) or a primary
vec4 wingStrandOf(float k) {
  float p = floor((k + 0.5) / ${g1(WING_STRANDS)}), q = p - ${g1(WING_PLUMES + WING_COVERTS)} * floor((p + 0.5) / ${g1(WING_PLUMES + WING_COVERTS)});   // AUDIT 4: whole numbers kept whole (a GPU dividing by a reciprocal comes out a hair short)
  float covert = q < ${g1(WING_PLUMES)} ? 0.0 : 1.0;
  float place = covert > 0.5 ? (q - ${g1(WING_PLUMES)}) / ${g1(WING_COVERTS - 1)} : q / ${g1(WING_PLUMES - 1)};
  return vec4(p < ${g1(WING_PLUMES + WING_COVERTS)} ? -1.0 : 1.0, place, k - ${g1(WING_STRANDS)} * p, covert);
}
// a point given along the torso (x its right, y up its spine, z out of its chest), about the shoulders' middle, in the
// body's frame
vec3 wingBack(vec3 l) { return uCapeS.xyz + cross(uTorsoU, uTorsoF) * l.x + uTorsoU * l.y + uTorsoF * l.z; }
vec3 wingPoint(float k, float t, float time) {
  vec4 s = wingStrandOf(k);
  float ph = wingHash(k) * 6.283185307179586;
  float breathe = sin(time * 6.283185307179586 ${hzGlsl(WING_HZ.breathe)});
  float beat = wingBeat(t, time);
  float m = s.z, off = m < 0.5 ? 0.0 : (mod(m, 2.0) > 0.5 ? 1.0 : -1.0) * ceil(m * 0.5) * 0.022;   // the fine strands either side of the broad, bundled with it as a feather
  float th = (s.w > 0.5 ? mix(${g3(WING_COVERT.spread[0])}, ${g3(WING_COVERT.spread[1])}, s.y) : mix(${g3(WING_SPREAD[0])}, ${g3(WING_SPREAD[1])}, s.y))
    + 0.07 * breathe - ${g3(WING_BEAT.down)} * beat * (0.5 + 0.5 * s.y) + off;
  float reach = (s.w > 0.5 ? mix(${g3(WING_COVERT.reach[0])}, ${g3(WING_COVERT.reach[1])}, s.y) : mix(${g3(WING_REACH[0])}, ${g3(WING_REACH[1])}, smoothstep(0.0, 0.8, s.y)))
    * (m > 0.5 ? 0.82 + 0.16 * wingHash(k + 3.1) : 1.0);
  vec3 root = vec3(s.x * ${g3(WING_ROOT.apart)} * uCapeS.w, -${g3(WING_ROOT.below)}, -${g3(WING_ROOT.back)} - uWingBack);   // WINGS-FIT: a sprite's further back (uWingBack)
  float back = s.w > 0.5 ? -0.3 : -0.2;
  vec3 ctrl = root + vec3(s.x * 0.18, 0.3 + 0.25 * max(sin(th), 0.0), back) * reach;   // rising first, then out
  vec3 tip = root + vec3(s.x * cos(th), sin(th), back - 0.02 + ${g3(WING_BEAT.forward)} * beat) * reach;
  float u = 1.0 - t;
  vec3 l = u * u * root + 2.0 * u * t * ctrl + t * t * tip;
  l.y -= 0.16 * reach * t * t * t * (0.4 + 0.6 * s.y);   // the tips drooping as a long feather's do
  // THE FLOW: waves running out along it - up and down, back and forth, and a little in and out
  float amp = (s.w > 0.5 ? 0.04 : 0.08 + 0.01 * m) * pow(t, 1.4);
  l.y += amp * sin(6.283185307179586 * 1.3 * t - time * 6.283185307179586 ${hzGlsl(WING_HZ.wave)} + ph);
  l.z += amp * 0.8 * cos(6.283185307179586 * 1.0 * t - time * 6.283185307179586 ${hzGlsl(WING_HZ.flutter)} + ph * 1.3);
  l.x += s.x * amp * 0.4 * sin(6.283185307179586 * 0.8 * t - time * 6.283185307179586 ${hzGlsl(WING_HZ.wave)} + ph * 0.7);
  vec3 b = wingBack(l);
  // THE SWING (auraMotionStep): trailing the wearer's motion the further out, lifting in a fall
  float tt = pow(t, 1.5);
  b.x += uSwing.x * 1.3 * tt;
  b.z += uSwing.y * 1.3 * tt;
  b.y += uSwing.z * 1.2 * t;
  return b;
}
vec3 wingWorld(vec3 b) { vec2 d = cloakWorldXZ(b.xz); return uAt + vec3(d.x, b.y, d.y); }
vec3 wingWorldDir(vec3 b) { vec2 d = cloakWorldXZ(b.xz); return vec3(d.x, b.y, d.y); }
// a spark's flight: spark k at the clock - which strand it rides (a new one each flight), how far out along it (past
// its tip at the last), its way along it (dir, the body's frame) and its age (w, 0 .. 1); each life divides the clock
vec4 wingMoteFlight(float k, float time, out vec3 dir) {
  float m = mod(k, 3.0), life = m < 0.5 ? ${g1(WING_MOTE_LIFE[0])} : m < 1.5 ? ${g1(WING_MOTE_LIFE[1])} : ${g1(WING_MOTE_LIFE[2])};
  float age = fract(time / life + fract(k * 0.618034));
  float which = mod(floor(time / life + fract(k * 0.618034)), ${g1(AURA_CLOCK_PERIOD)} / life);
  float strand = floor(wingHash(k * 7.0 + which * 1.31) * ${g1(WING_STRAND_COUNT)});
  float t = mix(0.25, 1.1, age), ta = min(t, 0.97);
  vec3 b = wingPoint(strand, ta, time);
  dir = wingPoint(strand, ta + 0.03, time) - b;
  b += dir * max(t - 0.97, 0.0) / 0.03 + vec3(0.0, 0.08 * age, 0.0);
  return vec4(b, age);
}
`;
/** SERAPH-WINGS: THE WINGS' LIGHT, the fragment half's - a strand (`p` across 0..1 and along 0..1; `s` its number, its
 *  fineness, a covert), the ground's pool, a spark (`p` across and along its streak) and the backlight. Added whole:
 *  what they answer is light. The beat flares them a moment. */
const WING_FS_GLSL = `
const vec3 WING_CORE = ${v3(WING_RGB.core)};
const vec3 WING_GOLD = ${v3(WING_RGB.gold)};
const vec3 WING_AMBER = ${v3(WING_RGB.amber)};
float wingBreath() { return 0.85 + 0.15 * sin(uTime * TAU ${hzGlsl(WING_HZ.breathe)}); }
// nothing laid over an eye standing among them (the wearer's own first person)
float wingNear() { return smoothstep(0.25, 0.9, distance(uCamPos, vWorld)); }
vec3 wingStrand(vec2 p, vec3 s) {
  float a = p.x * 2.0 - 1.0, t = p.y, k = s.x, fine = s.y;
  float n = fine > 0.5 ? vnoiseP(vec2(t * ${g1(WING_FLOW.cells)} - uTime * ${g3(WING_FLOW.rate)}, k * 3.7), vec2(${g1(WING_FLOW.rate * AURA_CLOCK_PERIOD)}, 512.0))
    : fbmP(vec2(t * ${g1(WING_FLOW.cells)} - uTime * ${g3(WING_FLOW.rate)}, k * 3.7), vec2(${g1(WING_FLOW.rate * AURA_CLOCK_PERIOD)}, 512.0));
  float n2 = vnoiseP(vec2(t * ${g1(WING_FLOW.cells * 2.5)} - uTime * ${g3(WING_FLOW.fray)}, k * 5.3 + a * 1.5), vec2(${g1(WING_FLOW.fray * AURA_CLOCK_PERIOD)}, 1024.0));
  float edge = 1.0 - smoothstep(0.45 - 0.3 * n2, 1.0, abs(a));   // the edge fraying into wisps
  float core = exp(-a * a * (fine > 0.5 ? 22.0 : 30.0));
  float glow = exp(-a * a * (fine > 0.5 ? 4.0 : 6.0));
  float sheath = exp(-a * a * 1.8) * (1.0 - fine);   // the broad strand's soft glow about it
  float along = smoothstep(0.04, 0.22, t) * (1.0 - smoothstep(0.6 + 0.25 * n, 1.0, t));   // out of the back, and the tip frayed away
  float grown = 1.0 - smoothstep(uKindle * 1.15 - 0.15, uKindle * 1.15, t);   // unfurling from the root as it kindles
  float pulse = 0.55 + 0.45 * sin(TAU * 3.0 * t - uTime * TAU ${hzGlsl(WING_HZ.flow)} + k * 1.7);   // light running out along it
  float lit = (0.5 + 0.8 * n) * (0.7 + 0.3 * pulse) * along * edge * grown * wingBreath() * wingNear() * (1.0 + 0.25 * wingBeat(t, uTime));
  // WINGS-FIT: about half the light it had (0.22, 0.55, 0.6 + 0.6, 0.5; the beat's flare 0.4) - a pale gold thread with a
  // soft glow about it, not a white blaze
  vec3 col = WING_GOLD * sheath * 0.1 + mix(WING_AMBER, WING_GOLD, smoothstep(0.1, 0.7, glow)) * glow * 0.32 + WING_CORE * core * (0.42 + 0.28 * pulse) * smoothstep(0.0, 0.3, t);
  col += WING_AMBER * smoothstep(0.7, 0.95, t) * n2 * glow * 0.25;   // the tips burning as they fray
  return col * lit * (fine > 0.5 ? 0.7 : 1.0) * (s.z > 0.5 ? 0.45 : 1.0);   // the coverts beneath the primaries, softer
}
vec3 wingsGround(vec2 p) {
  float r = length(p);
  if (r > ${g3(WING_POOL_R)}) discard;
  return WING_GOLD * exp(-r * r / 0.45) * 0.07 * wingBreath() * uKindle * (1.0 - smoothstep(${g3(WING_POOL_R - 0.3)}, ${g3(WING_POOL_R)}, r));
}
vec3 wingMote(vec2 p, vec3 s) {
  vec2 q = p * 2.0 - 1.0;   // x across the streak, y along it - its head at +1
  float d = length(q);
  if (d > 1.0) discard;
  float life = smoothstep(0.0, 0.15, s.x) * (1.0 - smoothstep(0.6, 1.0, s.x));
  float streak = exp(-q.x * q.x * 20.0) * exp(-q.y * q.y * 1.6) * smoothstep(-1.0, 0.5, q.y);   // brightest at its head, a tail behind
  return (WING_CORE * streak * 0.65 + WING_GOLD * exp(-d * d * 3.5) * 0.15) * life * smoothstep(0.75, 1.0, uKindle) * wingNear();   // none till the wings have unfurled
}
// THE BACKLIGHT: a radiance behind the upper back - a soft gold glow, white at its heart, rays turning slowly in it
vec3 wingHalo(vec2 p, float away) {
  vec2 q = p * 2.0 - 1.0;
  float r = length(q);
  if (r > 1.0) discard;
  float a = r > 1e-4 ? atan(q.y, q.x) : 0.0;
  float rays = pow(max(0.5 + 0.5 * cos(14.0 * a + uTime * TAU ${hzGlsl(WING_HZ.rays)}), 0.0), 6.0) * 0.6 + pow(max(0.5 + 0.5 * cos(9.0 * a - uTime * TAU ${hzGlsl(2 * WING_HZ.rays)} + 1.3), 0.0), 10.0) * 0.4;   // AUDIT 4: never a pow of a negative (a cos a hair under -1)
  float glow = exp(-r * r * 7.0) * 0.16 + exp(-r * r * 2.2) * 0.05;   // WINGS-FIT: faint (0.55, 0.16; its heart 0.25, its rays 0.32)
  vec3 col = WING_CORE * exp(-r * r * 16.0) * 0.07 + WING_GOLD * (glow + rays * exp(-r * 2.6) * 0.1);
  return col * (1.0 - smoothstep(0.55, 1.0, r)) * wingBreath() * (1.0 + 0.25 * wingBeat(0.0, uTime)) * smoothstep(0.5, 1.0, uKindle) * wingNear() * away;
}
`;
export const AURA_VS = HEAD + `layout(location = 0) in vec2 aP;   // the ground: a corner -1..1; the flames: x the step round 0..1, y up 0..1; a symbol: x its number * 2 + the corner's u, y its v
uniform mat4 uVP;
uniform int uKind;      // 0 the ground, 1 the flames, 2 the ward's floating symbols (AEGIS)
uniform int uAura;      // SHADOW-CLOAK: the cloak's wall is its own mesh, and its third draw its emblems
uniform vec3 uAt;       // the feet
uniform float uGroundR, uRingR, uFlameH, uLift;
uniform float uTime;    // AEGIS: a symbol's flight
uniform float uYaw;     // SHADOW-CLOAK: the wearer's facing
uniform float uTorn;    // SHADOW-CLOAK: the seconds since the wearer turned beast (negative while not) - the tear, the shreds
uniform vec4 uSwing;    // SHADOW-CLOAK: the swing (auraMotionStep) - its trail along the body's right and forward (m), its lift (m), its lag on a turn (rad)
uniform vec4 uCapeS;    // SHADOW-CLOAK: the shoulders' middle in the body's frame (x right, y up, z forward, m about the feet) - the pose it hangs from - and (w) its scale across them
uniform vec4 uCapeH;    // SHADOW-CLOAK: the head's middle in the same frame, and (w) its turn from the body's (rad)
uniform vec3 uKneeL, uKneeR;   // SHADOW-CLOAK: the knees, in the same frame
uniform vec3 uTorsoU, uTorsoF;   // SERAPH-WINGS: the torso's up (along its spine) and forward (out of its chest) in the same frame (auraCapePose) - the back the wings grow from
uniform float uWingBack;   // WINGS-FIT: how much further back the wings root (m) - a sprite's flat card (WING_SPRITE_BACK), else 0
uniform vec3 uCamPos;   // AEGIS: the eye a symbol faces
out vec2 vP;            // the ground: metres about the feet; the flames: (the angle's share, the height's); a symbol: its card's uv
out vec3 vWorld;
out vec3 vS;            // AEGIS: a symbol's age, its rune's place in the script and its number
${WARD_FLIGHT_GLSL}${CLOAK_SHAPE_GLSL}${CLOAK_VS_GLSL}${WING_SHARED_GLSL}${WING_VS_GLSL}
void main() {
  vec3 w;
  vS = vec3(0.0);
  if (uKind == 0) {
    vP = aP * uGroundR;
    w = uAt + vec3(vP.x, uLift, vP.y);
  } else if (uKind == 1 && uAura == 3) {
    // SHADOW-CLOAK: the cloak's cloth, (u round from the front, v up) on its own mesh
    vP = aP;
    w = cloakPoint(aP, uTime);
  } else if (uKind == 1 && uAura == 4) {
    // SERAPH-WINGS: A STRAND, (its number * 2 + across 0..1, along 0..1) - laid along its curve, turned to the eye along
    // its length, its width growing out of the back and narrowing to the tip
    float k = floor(aP.x * 0.5), across = aP.x - k * 2.0, t = aP.y;
    vec4 st = wingStrandOf(k);
    float fine = st.z > 0.5 ? 1.0 : 0.0;
    vec3 c = wingWorld(wingPoint(k, t, uTime));
    vec3 along = t < 0.99 ? wingWorld(wingPoint(k, t + 0.01, uTime)) - c : c - wingWorld(wingPoint(k, t - 0.01, uTime));   // AUDIT 4: forward at the tip too (backward, the last segment twisted into a bowtie)
    vec3 side = cross(along, uCamPos - c);
    float sl = length(side);
    side = sl > 1e-6 ? side / sl : vec3(0.0, 1.0, 0.0);
    float width = mix(${g3(WING_W.broad)} * (st.w > 0.5 ? 0.6 : 1.0), ${g3(WING_W.fine)}, fine) * (0.3 + 0.7 * smoothstep(0.0, 0.25, t)) * (1.0 - 0.55 * t * t);
    w = c + side * (across - 0.5) * width;
    vP = vec2(across, t);
    vS = vec3(k, fine, st.w);
  } else if (uKind == 1) {
    float a = aP.x * 6.283185307179586;
    vP = aP;
    w = uAt + vec3(cos(a) * uRingR, uLift + aP.y * uFlameH, sin(a) * uRingR);
  } else if (uAura == 3) {
    // SHADOW-CLOAK: AN EMBLEM - its card at its flight's place, upright, turned round the vertical to the eye and
    // turning a little either way of it as it climbs, as a medal hung on a thread does; past the emblems, A SHRED of the
    // torn cloak - turning in its own plane and tumbling
    float k = floor(aP.x * 0.5);
    vP = vec2(aP.x - k * 2.0, aP.y);
    vec4 f;
    vec2 o;
    if (k < ${g1(CLOAK_EMBLEMS)}) {
      f = cloakEmblemFlight(k, uTime);
      o = (vP - 0.5) * ${g3(CLOAK_EMBLEM_M)} * (0.85 + 0.3 * f.w);
      o.x *= cos(0.55 * sin(f.w * CLOAK_TAU + k * 1.3));
      vS = vec3(f.w, 0.0, k);
    } else {
      float j = k - ${g1(CLOAK_EMBLEMS)}, since = max(uTorn, 0.0);
      f = cloakShredFlight(j, since);
      o = (vP - 0.5) * ${g3(CLOAK_SHRED_M)};
      o = vec2(o.x * cos(f.w) - o.y * sin(f.w), o.x * sin(f.w) + o.y * cos(f.w));
      o.x *= cos(since * CLOAK_TAU ${hzGlsl(CLOAK_SHRED_HZ.tumble)} + j);
      vS = vec3(0.0, 1.0, j);
    }
    vec3 c = uAt + f.xyz;
    vec2 toEye = uCamPos.xz - c.xz;
    toEye = dot(toEye, toEye) > 1e-8 ? normalize(toEye) : vec2(0.0, 1.0);
    // the card's x the eye's own right as the frame shows it (world/mat4.js HANDEDNESS: world +x on screen right), so
    // the glyph faces the way the badge's does
    w = c + vec3(-toEye.y, 0.0, toEye.x) * o.x + vec3(0.0, o.y, 0.0);
  } else if (uAura == 4) {
    // SERAPH-WINGS: A SPARK - a streak of light riding a strand out, its length along its way as the eye sees it; past
    // the sparks, THE BACKLIGHT - one card of radiance behind the upper back, square to the eye
    float k = floor(aP.x * 0.5);
    vP = vec2(aP.x - k * 2.0, aP.y);
    if (k < ${g1(WING_MOTES)}) {
      vec3 way;
      vec4 f = wingMoteFlight(k, uTime, way);
      vec3 c = wingWorld(f.xyz);
      vec3 e = uCamPos - c;
      float el = length(e);
      e = el > 1e-6 ? e / el : vec3(0.0, 0.0, 1.0);
      vec3 dw = wingWorldDir(way);
      vec3 along = dw - e * dot(dw, e);
      float al = length(along);
      along = al > 1e-6 ? along / al : vec3(0.0, 1.0, 0.0);
      vec3 across = cross(e, along);
      vec2 o = (vP - 0.5) * vec2(${g3(WING_MOTE_M)}, ${g3(WING_MOTE_LEN)}) * (1.0 - 0.4 * f.w);
      w = c + across * o.x + along * o.y;
      vS = vec3(f.w, 0.0, k);
    } else {
      vec3 c = wingWorld(wingBack(vec3(0.0, 0.12, -0.32 - uWingBack)));   // WINGS-FIT: behind the roots, wherever they are
      vec3 e = uCamPos - c;
      float el = length(e);
      e = el > 1e-6 ? e / el : vec3(0.0, 0.0, 1.0);
      vec3 r = cross(vec3(0.0, 1.0, 0.0), e);
      float rl = length(r);
      r = rl > 1e-6 ? r / rl : vec3(1.0, 0.0, 0.0);
      vec2 o = (vP - 0.5) * ${g3(WING_HALO_M)};
      w = c + r * o.x + cross(e, r) * o.y;
      vS = vec3(smoothstep(${g3(WING_HALO_NEAR[0])}, ${g3(WING_HALO_NEAR[1])}, el), 2.0, k);   // AUDIT 4: gone with the eye near its middle (the wearer's own first person, looking down: it washed the floor gold)
    }
  } else {
    // AEGIS: A FLOATING SYMBOL - its card at its flight's place, upright and turned round the vertical to face the eye,
    // tilting a little as it climbs and growing as it fades
    float k = floor(aP.x * 0.5);
    vP = vec2(aP.x - k * 2.0, aP.y);
    vec4 f = wardFlight(k, uTime);
    vec3 c = uAt + f.xyz;
    vec2 d = uCamPos.xz - c.xz;
    d = dot(d, d) > 1e-8 ? normalize(d) : vec2(0.0, 1.0);
    float tilt = 0.22 * sin(f.w * 5.0 + k * 1.7);
    vec2 o = (vP - 0.5) * vec2(${WARD_GLYPH_W.toFixed(2)}, ${WARD_GLYPH_H.toFixed(2)}) * (1.0 + 0.35 * f.w);
    o = vec2(o.x * cos(tilt) - o.y * sin(tilt), o.x * sin(tilt) + o.y * cos(tilt));
    w = c + vec3(d.y, 0.0, -d.x) * o.x + vec3(0.0, o.y, 0.0);
    vS = vec3(f.w, mod(k * 5.0 + wardFlightOf(k, uTime), ${WARD_RUNES.toFixed(1)}), k);
  }
  vWorld = w;
  gl_Position = uVP * vec4(w, 1.0);
}`;
export const AURA_FS = HEAD + `in vec2 vP;
in vec3 vWorld;
in vec3 vS;             // AEGIS: a floating symbol's age, rune and number
uniform int uKind;
uniform int uAura;      // AEGIS: 0 Dagon's Fire, 1 the Oblivion Ward, 2 the Golden Radiance (AURA_LOOK - PRIMARCH), 3 the Holo Shadow Cloak (SHADOW-CLOAK), 4 the Seraph Wings (SERAPH-WINGS)
uniform vec3 uAt;       // PRIMARCH: the feet - the axis the radiance's column stands on
uniform float uYaw;     // SHADOW-CLOAK: the wearer's facing - the cloak's opening is at their front
uniform int uSide;      // SHADOW-CLOAK: which side of the cloth this draw lays - 0 its lining (front faces culled), 1 its outside (back faces culled)
uniform float uTorn;    // SHADOW-CLOAK: the seconds since the wearer turned beast (negative while not)
uniform vec4 uSwing, uCapeH;   // SHADOW-CLOAK: the swing - its lag on a turn (w) turns the cloth's facing too; the head's middle (uCapeH) - the hood an eye can stand inside
uniform float uTime, uSeed, uKindle, uRingR, uGroundR, uFlameH;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
out vec4 o;
${FOG_FACTOR_GLSL}${NOISE_GLSL}
const float TAU = 6.283185307179586;
${WARD_GLSL}${RADIANCE_GLSL}${CLOAK_SHAPE_GLSL}${CLOAK_FS_GLSL}${WING_SHARED_GLSL}${WING_FS_GLSL}
void main() {
  if (uAura == 4) { vec3 wl = uKind == 0 ? wingsGround(vP) : uKind == 1 ? wingStrand(vP, vS) : vS.y > 1.5 ? wingHalo(vP, vS.x) : wingMote(vP, vS); o = vec4(wl * fogFactorAt(vWorld), 1.0); return; }   // SERAPH-WINGS: added whole; kindled within (the strands unfurl)
  if (uAura == 3) {   // SHADOW-CLOAK: premultiplied - the light it adds, and how much the shadow covers; both fogged
    vec4 c = uKind == 0 ? cloakGround(vP) : uKind == 1 ? cloakWall(vP) : vS.y > 0.5 ? cloakShred(vP, vS) : cloakEmblem(vP, vS);
    float f = fogFactorAt(vWorld) * uKindle;
    o = vec4(c.rgb * f, c.a * f);
    return;
  }
  if (uAura == 2) { vec3 rad = uKind == 0 ? radianceGround(vP) : radianceWall(vP); o = vec4(rad * uKindle * fogFactorAt(vWorld), 1.0); return; }   // PRIMARCH
  if (uAura == 1) { vec3 ward = uKind == 0 ? wardGround(vP) : uKind == 1 ? wardWall(vP) : wardSymbol(vP, vS); o = vec4(ward * uKindle * fogFactorAt(vWorld), 1.0); return; }   // AEGIS
  // every rate a whole number of cycles over the clock, in turns a second times TAU - never a rounded radian rate, which
  // drifts off whole by its rounding times the period and steps the picture at the wrap
  float turn = uTime * TAU * ${AURA_TURN_HZ.toFixed(3)};   // the ring's own turn
  vec3 col;
  if (uKind == 0) {
    float r = length(vP), a = atan(vP.y, vP.x);
    if (r > uGroundR) discard;
    float u = fract((a + turn) / TAU);            // the angle, carried round with the turn
    // the fire in the band: noise flowing round the ring and outward, broken into tongues
    float flow = fbmP(vec2(u * ${AURA_ROUND.ground.toFixed(1)} + floor(uSeed * 7.0), r * 3.2 - uTime * ${AURA_FLOW.ground.toFixed(3)}), vec2(${AURA_ROUND.ground.toFixed(1)}, ${(AURA_FLOW.ground * AURA_CLOCK_PERIOD).toFixed(1)}));
    float band = 1.0 - smoothstep(0.0, 0.26, abs(r - uRingR - (flow - 0.5) * 0.16));   // edges in order: GLSL leaves smoothstep's reversed edges undefined
    float crest = 0.55 + 0.45 * sin(u * TAU * 7.0 - uTime * TAU * 1.5);   // bright crests chasing about it
    float heat = band * (0.35 + 0.65 * flow) * (0.7 + 0.3 * crest);
    // the embers: ten sparks circling in the band, each at a whole multiple of the turn and its own wander
    float ember = 0.0;
    for (int k = 0; k < 10; k++) {
      float fk = float(k), s = fract(sin(fk * 91.7 + uSeed * 13.1) * 43758.5);
      float ea = fk / 10.0 * TAU + turn * (1.0 + floor(s * 3.0)) + s * TAU;
      float er = uRingR + 0.12 * sin(uTime * TAU * 0.25 * (1.0 + fk * 0.5) + fk);
      vec2 ep = vec2(cos(ea), sin(ea)) * er;
      float d = length(vP - ep);
      ember += exp(-d * d * 900.0) * (0.6 + 0.4 * sin(uTime * TAU * 1.5 + fk * 3.0));
    }
    // the glow in the stone within, and the ring's edge soft
    float inner = 0.22 * (1.0 - smoothstep(0.0, uRingR, r)) * (0.8 + 0.2 * sin(uTime * TAU / 3.0 + uSeed));
    float edge = 1.0 - smoothstep(uGroundR - 0.35, uGroundR, r);
    col = fireRamp(clamp(heat * 1.05, 0.0, 1.0)) * heat * 0.95 + vec3(1.0, 0.72, 0.30) * ember * 1.2 + vec3(0.55, 0.08, 0.02) * inner;
    col *= edge;
  } else {
    float u = fract(vP.x + turn / TAU), v = vP.y;
    // TONGUES: noise stretched up the wall and scrolled up and round, swaying; a flame stands where the noise clears a
    // threshold rising with the height, so the tongues thin and part toward their tips, a hot heart where it clears most
    float sway = 0.012 * sin(v * 9.0 + uTime * TAU * 1.5 + u * TAU * 5.0);
    float n = fbmP(vec2((u + sway) * ${AURA_ROUND.flames.toFixed(1)} + floor(uSeed * 5.0), v * 1.3 - uTime * ${AURA_FLOW.rise.toFixed(3)}), vec2(${AURA_ROUND.flames.toFixed(1)}, ${(AURA_FLOW.rise * AURA_CLOCK_PERIOD).toFixed(1)}));
    float n2 = vnoiseP(vec2(u * ${AURA_ROUND.flicker.toFixed(1)}, v * 3.0 - uTime * ${AURA_FLOW.flicker.toFixed(3)}), vec2(${AURA_ROUND.flicker.toFixed(1)}, ${(AURA_FLOW.flicker * AURA_CLOCK_PERIOD).toFixed(1)}));
    float f = n * 0.8 + n2 * 0.25;
    float th = 0.28 + v * 0.62;
    float body = smoothstep(th - 0.06, th + 0.10, f);
    float core = smoothstep(th + 0.06, th + 0.25, f);
    float fade = pow(1.0 - v, 1.3);
    col = (fireRamp(0.3 + 0.45 * core) * body * 0.8 + vec3(1.0, 0.8, 0.45) * core * 0.3) * fade;
  }
  o = vec4(col * uKindle * fogFactorAt(vWorld), 1.0);
}`;

const NO_FOG_RANGE = new Float32Array([0, 1]);
const NO_FOCUS = new Float32Array(4);   // AUDIT DEEP R-1: no travel view - w 0, the fog measures from the camera
function mat4Multiply(out, a, b) {
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return out;
}

/** The flames' strip: AURA_STEPS quads round, two triangles each, as (step, up) pairs. Pure. */
export function auraFlameStrip() {
  const out = [];
  for (let i = 0; i < AURA_STEPS; i++) {
    const a = i / AURA_STEPS, b = (i + 1) / AURA_STEPS;
    out.push(a, 0, b, 0, b, 1, a, 0, b, 1, a, 1);
  }
  return new Float32Array(out);
}

/** AEGIS: the floating symbols' cards - `n` quads, two triangles each, as (number * 2 + the corner's u, its v). Pure. */
export function auraGlyphCards(n) {
  const out = [];
  for (let k = 0; k < n; k++) for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]]) out.push(k * 2 + u, v);
  return new Float32Array(out);
}

/** SHADOW-CLOAK: the cloak's mesh - CLOAK_ROUND steps round by CLOAK_ROWS up, two triangles a cell, as (u round from the
 *  front, v up) pairs. Pure. */
export function auraCloakGrid() {
  const out = [];
  for (let j = 0; j < CLOAK_ROWS; j++) {
    const v0 = j / CLOAK_ROWS, v1 = (j + 1) / CLOAK_ROWS;
    for (let i = 0; i < CLOAK_ROUND; i++) {
      const u0 = i / CLOAK_ROUND, u1 = (i + 1) / CLOAK_ROUND;
      out.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
    }
  }
  return new Float32Array(out);
}
/** SERAPH-WINGS: the wings' mesh - each of WING_STRAND_COUNT strands a ribbon of WING_SEGS segments, two triangles each,
 *  as (its number * 2 + across 0 or 1, along 0..1) pairs. Pure. */
export function auraWingsGrid() {
  const out = [];
  for (let k = 0; k < WING_STRAND_COUNT; k++) {
    const a = k * 2, b = k * 2 + 1;
    for (let j = 0; j < WING_SEGS; j++) {
      const t0 = j / WING_SEGS, t1 = (j + 1) / WING_SEGS;
      out.push(a, t0, b, t0, b, t1, a, t0, b, t1, a, t1);
    }
  }
  return new Float32Array(out);
}
/** The cards the third draw has to hand: the most any look floats (the ward's symbols, the cloak's emblems and shreds). */
export const AURA_CARDS = Math.max(...Object.values(AURA_LOOK).map((l) => l.glyphs + ('shreds' in l ? l.shreds : 0)));

/** SHADOW-CLOAK: THE BODY'S POSE AT REST - what the cape's measures are drawn about, in the body's frame (x right, y
 *  up, z forward, m about the feet): the shoulders' middle (w its scale across them - 1 at rest), the head's middle (w
 *  its turn from the body's, rad), and no knee to press it (at the feet's own axis, nowhere). A wearer with no posed
 *  body hangs it from this. */
export const CLOAK_REST_POSE = Object.freeze({ shoulders: Float32Array.of(0, CLOAK_SHOULDER_Y, 0, 1), head: Float32Array.of(0, CLOAK_HOOD_Y, 0, 0), kneeL: new Float32Array(3), kneeR: new Float32Array(3), torso: Float32Array.of(0, 1, 0, 0, 0, 1), wingBack: 0 });   // SERAPH-WINGS: the torso upright and facing forward; WINGS-FIT: the wings at the back itself
/** SHADOW-CLOAK: THE BONES IT HANGS FROM - the retail third-person skeleton's (base_anim.nif and its kin, lowercase as
 *  the skeleton's byName keeps them): the shoulder joints, the neck and the head, the knees. */
export const CLOAK_BONES = Object.freeze(['bip01 l upperarm', 'bip01 r upperarm', 'bip01 neck', 'bip01 head', 'bip01 l calf', 'bip01 r calf', 'bip01 spine2']);   // SERAPH-WINGS: and the upper spine, the back's own up
/** The rest shoulders' half-width its measures assume (m) - a broader or narrower body scales the cloth across, within
 *  CLOAK_ACROSS - and how far past the head's own joint (the top of the neck) its middle is, along the neck (m). */
export const CLOAK_SHOULDER_HALF = 0.2;
export const CLOAK_ACROSS = Object.freeze([0.8, 1.25]);
export const CLOAK_HEAD_ABOVE = 0.09;

/** SHADOW-CLOAK: THE POSE FROM THE BONES - `bones` the body's (fpArm.thirdBones: each [right, up, forward] m about its
 *  feet, or null) - the shoulders' middle and the scale across them, the head's middle and the knees, written into
 *  `out` (or a new pose); null when the shoulders or the head are missing (another skeleton - the wolf's), so the cape
 *  hangs at rest. Pure but for `out`. */
export function auraCapePose(bones, out = null) {
  const L = bones?.['bip01 l upperarm'], R = bones?.['bip01 r upperarm'], N = bones?.['bip01 neck'], H = bones?.['bip01 head'];
  if (!L || !R || !H) return null;
  const o = out ?? { shoulders: new Float32Array(4), head: new Float32Array(4), kneeL: new Float32Array(3), kneeR: new Float32Array(3), torso: new Float32Array(6) };
  const half = Math.hypot(L[0] - R[0], L[1] - R[1], L[2] - R[2]) / 2;
  const S = o.shoulders, Hd = o.head;
  S[0] = (L[0] + R[0]) / 2; S[1] = Math.max((L[1] + R[1]) / 2, CLOAK_SHOULDER_Y * 0.4); S[2] = (L[2] + R[2]) / 2; S[3] = Math.max(CLOAK_ACROSS[0], Math.min(CLOAK_ACROSS[1], half / CLOAK_SHOULDER_HALF));   // never lower than a crouch's floor (AUDIT 2: a pose at the feet hangs nothing)
  const ux = N ? H[0] - N[0] : 0, uy = N ? H[1] - N[1] : 1, uz = N ? H[2] - N[2] : 0, ul = Math.hypot(ux, uy, uz) || 1;
  Hd[0] = H[0] + (ux / ul) * CLOAK_HEAD_ABOVE; Hd[1] = Math.max(H[1] + (uy / ul) * CLOAK_HEAD_ABOVE, S[1] + 0.18); Hd[2] = H[2] + (uz / ul) * CLOAK_HEAD_ABOVE; Hd[3] = 0;   // the head a neck over the shoulders at least (AUDIT 2: nearer, the collar folds over itself)
  o.kneeL.set(bones['bip01 l calf'] ?? [0, 0, 0]);
  o.kneeR.set(bones['bip01 r calf'] ?? [0, 0, 0]);
  auraTorso(L, R, bones['bip01 spine2'] ?? null, N ?? null, H, o.torso ?? (o.torso = new Float32Array(6)));
  o.sunk = bones.sunk === true;   // AUDIT 3: a sprite sunk to its neck (auraSpriteBones) - folded, closed
  o.wingBack = Number.isFinite(bones.wingBack) ? bones.wingBack : 0;   // WINGS-FIT: a sprite's flat card - the wings rooted further back (auraSpriteBones)
  return o;
}
/** SERAPH-WINGS: THE TORSO'S OWN AXES, written into `out` [up, forward] - up the spine (the upper spine to the neck, or
 *  the neck to the head without it), across from the left shoulder to the right, and forward out of the chest square to
 *  both - so what grows from the back leans and turns as the back does. Upright and facing forward where the bones
 *  cannot say. Pure but for `out`. */
export function auraTorso(L, R, spine, neck, head, out) {
  const lo = spine && neck ? spine : neck, hi = spine && neck ? neck : head;
  let ux = lo ? hi[0] - lo[0] : 0, uy = lo ? hi[1] - lo[1] : 1, uz = lo ? hi[2] - lo[2] : 0;
  let rx = R[0] - L[0], ry = R[1] - L[1], rz = R[2] - L[2];
  let fx = ry * uz - rz * uy, fy = rz * ux - rx * uz, fz = rx * uy - ry * ux;   // right x up: forward
  const fl = Math.hypot(fx, fy, fz);
  if (!(fl > 1e-6) || !(Math.hypot(ux, uy, uz) > 1e-6)) { out.set(CLOAK_REST_POSE.torso); return out; }
  fx /= fl; fy /= fl; fz /= fl;
  ux = fy * rz - fz * ry; uy = fz * rx - fx * rz; uz = fx * ry - fy * rx;   // forward x right: up, square to both
  const ul = Math.hypot(ux, uy, uz);
  if (!(ul > 1e-6) || uy / ul < 0.2) { out.set(CLOAK_REST_POSE.torso); return out; }   // a back upside down or flat is no back to grow from
  out[0] = ux / ul; out[1] = uy / ul; out[2] = uz / ul; out[3] = fx; out[4] = fy; out[5] = fz;
  return out;
}

/** SERAPH-WINGS: THE EYE OF THE BEHOLDER FIGURE - a sprite body has no bones, so what stands for them is read off the frame
 *  it is drawn in: its base over the feet and its metres a pixel (eotbBody figure(), peerRiders figureOf).
 *  AUDIT 3 (2026-10-05): BY THE PIXEL, NOT BY THE FRAME'S HEIGHT. A frame is as tall as what it holds - a sword up, a
 *  staff, a hand raised to cast (to 174 px) - and the shoulders at 0.8 of it hung the cloak and the wings 0.3 - 1 m over
 *  the head whenever a weapon was out, jumping as it was drawn or sheathed. The sets' own shoulders stand 78 - 88 px
 *  over the frame's foot whatever it holds (measured off the frames' alpha: Idle 88, IdleMelee 80, IdleSpell 84,
 *  IdleRanged 87). So: the shoulder line, the neck, the head's joint and the upper spine in the sets' pixels over the
 *  frame's foot; a beast's frames (`beast` - drawn at 0.029 m a pixel, the beast smaller in them) stand them at `beast`
 *  of that (shoulders 1.70 m, measured 1.65 - 1.74); across as broad as its metres a pixel are to the standing scale's
 *  (`mpp`). */
export const EOTB_FIGURE = Object.freeze({ mpp: 0.019, shoulder: 86, neck: 91, head: 96, spine: 75, beast: 0.68 });
/** The bones a sprite figure stands for, in the body's frame - or null without a figure. `sunk` when its shoulders are
 *  below the crouch's floor (the body sunk in water to its neck - its quad's top at the waterline): nothing hangs from
 *  them, and the cloak folds and the wings close as on a rider (AUDIT 3: hung at the floor, it floated over the
 *  swimmer). WINGS-FIT: `wingBack` - its wings rooted WING_SPRITE_BACK further behind its flat card, as big as the sprite
 *  is drawn. Pure. */
export function auraSpriteBones(fig) {
  if (!fig || !Number.isFinite(fig.base) || !(fig.mpp > 0)) return null;
  const m = fig.mpp * (fig.beast === true ? EOTB_FIGURE.beast : 1), at = (px) => fig.base + px * m, half = CLOAK_SHOULDER_HALF * m / EOTB_FIGURE.mpp;
  return {
    'bip01 l upperarm': [-half, at(EOTB_FIGURE.shoulder), 0], 'bip01 r upperarm': [half, at(EOTB_FIGURE.shoulder), 0],
    'bip01 neck': [0, at(EOTB_FIGURE.neck), 0], 'bip01 head': [0, at(EOTB_FIGURE.head), 0], 'bip01 spine2': [0, at(EOTB_FIGURE.spine), 0],
    'bip01 l calf': null, 'bip01 r calf': null, sunk: at(EOTB_FIGURE.shoulder) < CLOAK_SHOULDER_Y * 0.4, wingBack: WING_SPRITE_BACK * m / EOTB_FIGURE.mpp,
  };
}
/** A peer's sprite figure as the pose `auraCapeStep` takes - at the wearer's own feet and facing - or null. Pure. */
export const auraSpritePosed = (w, fig) => (fig ? { feet: w.at, yaw: w.yaw, bones: auraSpriteBones(fig) } : null);
/** SERAPH-WINGS: THE WINGS' LIGHT ON THE WORLD - a gold light where they grow, behind the shoulders, for the nearest
 *  wearers of them within `reach` of the eye (at most `max`): `range` (m) as the wings are kindled, `rgb` its colour.
 *  A carried light (no glare of its own, no shadow slot - the torch's law). Outdoors the city's light colour stands
 *  for every carried light (world.js); in a dungeon or a building it is gold. */
export const WING_LIGHT = Object.freeze({ range: 4.5, rgb: Object.freeze([0.7, 0.53, 0.24]), lift: 0.15, back: 0.35, max: 3, reach: 40 });   // WINGS-FIT: 4.5 m and seven tenths (were 7 m, [1, 0.76, 0.34])
/** The wings' lights this frame, nearest first, written into `out` (one list, refilled) and answered. Pure but for
 *  `out`. @param {any[]} wearers @param {number[]|Float32Array|null} eye @param {any[]} out */
export function auraWingLights(wearers, eye, out) {
  out.length = 0;
  if (!Array.isArray(wearers) || !eye) return out;
  const L = WING_LIGHT;
  for (const w of wearers) {
    if (!w || auraLookOf(w.aura).mesh !== 'wings' || !Array.isArray(w.at) || w.cape?.sunk === true) continue;   // AUDIT 3: closed (sunk to the neck), unlit
    const k = Number.isFinite(w.kindle) ? Math.max(0, Math.min(1, w.kindle)) : 1;
    if (!(k > 0)) continue;
    const yaw = Number.isFinite(w.yaw) ? w.yaw : 0, c = Math.cos(yaw), sn = Math.sin(yaw), pose = w.cape ?? CLOAK_REST_POSE, sh = pose.shoulders;
    const back = L.back + (Number.isFinite(pose.wingBack) ? pose.wingBack : 0);   // WINGS-FIT: behind a sprite's roots, where they are
    const x = w.at[0] + c * sh[0] + sn * (sh[2] - back), y = w.at[1] + sh[1] + L.lift, z = w.at[2] - sn * sh[0] + c * (sh[2] - back);
    const d = Math.hypot(x - eye[0], y - eye[1], z - eye[2]);
    if (!(d <= L.reach)) continue;
    out.push({ x, y, z, range: L.range * (0.5 + 0.5 * k), color: [L.rgb[0] * k, L.rgb[1] * k, L.rgb[2] * k], carried: true, aura: true, _d: d });   // AUDIT 3: `aura` - the dungeon's flame tint passes it by (worldModes.js _dgTint)
  }
  out.sort((a, b) => a._d - b._d);
  if (out.length > L.max) out.length = L.max;
  return out;
}
/** SERAPH-WINGS: how far a rider's shoulders stand over a walker's (m) - the saddle's (player/motor.js RIDE_EYE_HEIGHT less
 *  EYE_HEIGHT): a mounted wearer without bones hangs from the rest pose lifted so far. */
export const AURA_SADDLE_M = 0.81;

/** SHADOW-CLOAK: THE POSE A WEARER'S CAPE HANGS FROM THIS FRAME, set on `w` (`w.cape`): `posed` the body's own - { feet,
 *  yaw, bones } (mwView mwViewBodyBones beside my body's feet and yaw; peerBodies bonesOf) - the cape placed where that
 *  body is drawn (its feet and yaw, which the gather's may lag) and hung from its bones when they stand; else from the
 *  rest pose pressed down to `crouch` (the body's height over its standing height, 1 standing). Returns `w`. Pure but
 *  for `w`. */
export function auraCapeStep(w, posed, crouch = 1) {
  if (posed?.feet && Number.isFinite(posed.yaw)) { w.at[0] = posed.feet[0]; w.at[1] = posed.feet[1]; w.at[2] = posed.feet[2]; w.yaw = posed.yaw; }   // where the body is drawn
  const o = posed?.bones ? auraCapePose(posed.bones, w.cape && w.cape !== CLOAK_REST_POSE ? w.cape : null) : null;
  if (o) { w.cape = o; return w; }
  const k = Number.isFinite(crouch) ? Math.max(0.4, Math.min(1, crouch)) : 1, lift = w.mounted === true ? AURA_SADDLE_M : 0;   // SERAPH-WINGS: a rider's shoulders over the saddle
  if (k >= 1 && !lift) { w.cape = CLOAK_REST_POSE; return w; }
  const c = w.cape && w.cape !== CLOAK_REST_POSE ? w.cape : { shoulders: new Float32Array(4), head: new Float32Array(4), kneeL: new Float32Array(3), kneeR: new Float32Array(3), torso: new Float32Array(6) };
  c.shoulders.fill(0); c.shoulders[1] = CLOAK_SHOULDER_Y * k + lift; c.shoulders[3] = 1; c.head.fill(0); c.head[1] = CLOAK_HOOD_Y * k + lift; c.kneeL.fill(0); c.kneeR.fill(0); c.sunk = false; c.wingBack = 0;   // AUDIT 4: a reused pose never stays sunk (a swim, then a ride: the wings stayed closed); WINGS-FIT: nor rooted back for a sprite no longer drawn
  (c.torso ?? (c.torso = new Float32Array(6))).set(CLOAK_REST_POSE.torso);
  w.cape = c;
  return w;
}

/** SHADOW-CLOAK: THE CAPE'S SWING - how its hem answers its wearer's motion: the seconds of their speed it trails
 *  behind them (m per m/s, a walk's 4 m/s a hand and a half, a run's more) and the most it trails; the metres it lifts
 *  per m/s of falling and the most; the radians it lags per rad/s of turning and the most; and the spring it swings on
 *  (Hz, and its damping - under one, so it swings past and settles when they stop); the speeds smoothed over (s). A
 *  jump of more than `snap` metres in a frame and faster than `snapV` m/s (a door, a teleport, a step snapped, the
 *  floating origin moving the world) is no motion: nothing is read off it and the swing carries on as it was going. */
export const CLOAK_SWING = Object.freeze({ trail: 0.05, trailMax: 0.42, lift: 0.04, liftMax: 0.25, twist: 0.12, twistMax: 0.6, hz: 1.2, damp: 0.45, smooth: 0.1, snap: 0.5, snapV: 30 });

/** SHADOW-CLOAK: THE CAPE'S SWING, a wearer's step each frame - from their feet (`w.at`) and facing (`w.yaw`) at the
 *  clock `t` (s), whoever's body it is (a rig or a sprite, mine or a peer's): their velocity and turning, smoothed, set
 *  where the hem would hang - behind them by their speed, lifted by their fall, lagging their turn - and a damped
 *  spring carries it there. Writes `w.swing` { x, z (m, along the body's right and forward), lift (m), twist (rad) }
 *  and the state it keeps (`w.motion`); returns `w`. Pure but for `w`. */
const clampTo = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
export function auraMotionStep(w, t) {
  const S = CLOAK_SWING;
  const m = w.motion ?? (w.motion = { t: null, at: [0, 0, 0], yaw: 0, v: [0, 0, 0], yr: 0, p: [0, 0, 0, 0], q: [0, 0, 0, 0], goal: [0, 0, 0, 0] });
  const yaw = Number.isFinite(w.yaw) ? w.yaw : 0, at = w.at;
  const dt = m.t === null ? 0 : t - m.t;
  const jump = Math.hypot(at[0] - m.at[0], at[1] - m.at[1], at[2] - m.at[2]);
  if (m.t !== null && dt === 0) return w;   // a frame on the clock's same tick (a coarsened clock): nothing to read, nothing moved
  if (m.t === null || !(dt > 0) || dt > 0.5) { m.v.fill(0); m.yr = 0; m.p.fill(0); m.q.fill(0); }   // first seen, or back after a gap (or a clock run backwards): hanging still
  else {
    const a = 1 - Math.exp(-dt / S.smooth);
    if (jump <= Math.max(S.snap, S.snapV * dt)) { for (let i = 0; i < 3; i++) m.v[i] += ((at[i] - m.at[i]) / dt - m.v[i]) * a; m.yr += (wrapAngle(yaw - m.yaw) / dt - m.yr) * a; }   // the short way round (ONCRASH1: the one wrap); a placement (a door, a teleport, a snapped step, the floating origin moving the world) is no motion - the swing carries on as it was going
    const fwd = m.v[0] * Math.sin(yaw) + m.v[2] * Math.cos(yaw), right = m.v[0] * Math.cos(yaw) - m.v[2] * Math.sin(yaw);
    const g = m.goal;
    g[0] = clampTo(-right * S.trail, -S.trailMax, S.trailMax); g[1] = clampTo(-fwd * S.trail, -S.trailMax, S.trailMax);
    g[2] = clampTo(-m.v[1] * S.lift, -0.05, S.liftMax); g[3] = clampTo(-m.yr * S.twist, -S.twistMax, S.twistMax);
    const k = (2 * Math.PI * S.hz) ** 2, c = 2 * S.damp * 2 * Math.PI * S.hz;
    for (let n = Math.ceil(dt / (1 / 60)), h = dt / n; n > 0; n--) for (let i = 0; i < 4; i++) { m.q[i] += (k * (g[i] - m.p[i]) - c * m.q[i]) * h; m.p[i] += m.q[i] * h; }
  }
  m.t = t; m.at[0] = at[0]; m.at[1] = at[1]; m.at[2] = at[2]; m.yaw = yaw;
  const sw = w.swing ?? (w.swing = { x: 0, z: 0, lift: 0, twist: 0 });
  sw.x = m.p[0]; sw.z = m.p[1]; sw.lift = m.p[2]; sw.twist = m.p[3];
  return w;
}

/** SHADOW-CLOAK: THE BEAST FORM, a wearer's step each frame - `beast` whether they stand turned lycanthrope, `t` the
 *  clock (s). Turned, the cloak tears: `w.torn` the seconds since the turn, wrapped whole past the tear by the clock's
 *  period (the shreds' rates are whole over it, so their flights meet themselves); -1 while they are not. A wearer
 *  first seen already turned is already torn; turned back, its cloak kindles again from nothing (`w.since`). Writes `w`
 *  and returns it. */
export function auraBeastStep(w, beast, t) {
  if (w.beastAt === undefined) w.beastAt = beast ? t - CLOAK_RIP_S : null;
  if (beast) {
    if (w.beastAt === null) w.beastAt = t;
    const s = Math.max(0, t - w.beastAt);
    w.torn = s <= CLOAK_RIP_S ? s : CLOAK_RIP_S + ((s - CLOAK_RIP_S) % AURA_CLOCK_PERIOD);
  } else {
    if (w.beastAt !== null) { w.beastAt = null; w.since = t; }
    w.torn = -1;
  }
  return w;
}

export class AuraRingRenderer {
  constructor(gl) {
    this.gl = gl;
    this.program = buildProgram(gl, AURA_VS, AURA_FS, 'aura ring');
    this.u = {};
    for (const n of ['uVP', 'uKind', 'uAura', 'uAt', 'uGroundR', 'uRingR', 'uFlameH', 'uLift', 'uTime', 'uSeed', 'uKindle', 'uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos', 'uFocus', 'uYaw', 'uSide', 'uTorn', 'uSwing', 'uCapeS', 'uCapeH', 'uKneeL', 'uKneeR', 'uTorsoU', 'uTorsoF', 'uWingBack']) this.u[n] = gl.getUniformLocation(this.program, n);
    this.quadVao = gl.createVertexArray();
    gl.bindVertexArray(this.quadVao);
    this.quadBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    this.flameVao = gl.createVertexArray();
    gl.bindVertexArray(this.flameVao);
    this.flameBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.flameBuf);
    gl.bufferData(gl.ARRAY_BUFFER, auraFlameStrip(), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    this.glyphVao = gl.createVertexArray();   // AEGIS: the ward's floating symbols
    gl.bindVertexArray(this.glyphVao);
    this.glyphBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.glyphBuf);
    gl.bufferData(gl.ARRAY_BUFFER, auraGlyphCards(AURA_CARDS), gl.STATIC_DRAW);   // SHADOW-CLOAK: as many as the most any look floats
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    this.cloakVao = gl.createVertexArray();   // SHADOW-CLOAK: the cloak's cloth
    gl.bindVertexArray(this.cloakVao);
    this.cloakBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.cloakBuf);
    gl.bufferData(gl.ARRAY_BUFFER, auraCloakGrid(), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    this.wingsVao = gl.createVertexArray();   // SERAPH-WINGS: the wings' strands
    gl.bindVertexArray(this.wingsVao);
    this.wingsBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.wingsBuf);
    gl.bufferData(gl.ARRAY_BUFFER, auraWingsGrid(), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.bindVertexArray(null);
    this._vp = new Float32Array(16);
    /** how many auras the last draw burned, for the stats and the tests */
    this.drawn = 0;
  }

  /**
   * Draw the frame's auras - `list` `[{ at: [x, y, z] the wearer's feet in the scene, aura?, seed?, kindle? 0..1, yaw? }]`
   * (already picked: auraWearers) - with the frame's camera, its clock (`seconds`) and its fog as the renderer set it
   * ({ mode, density, range, camPos, focus }). Each in its own aura's look (AURA_LOOK - AEGIS); SHADOW-CLOAK: `yaw` the
   * wearer's facing (forward (sin, cos) in x, z - 0 when not given), which the cloak's parting faces. Nothing to draw,
   * nothing touched.
   */
  draw(list, proj, view, eye, seconds, fog = null) {
    this.drawn = 0;
    if (!Array.isArray(list) || !list.length) return;
    const gl = this.gl, U = this.u;
    mat4Multiply(this._vp, proj, view);
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(U.uVP, false, this._vp);
    gl.uniform1f(U.uTime, auraClock(seconds));
    gl.uniform1f(U.uGroundR, AURA_GROUND_R); gl.uniform1f(U.uLift, AURA_LIFT_M);   // AEGIS: the ring's radius and the wall's height per wearer, below
    gl.uniform1i(U.uFogMode, fog ? fog.mode : 0);
    gl.uniform1f(U.uFogDensity, fog?.density ?? 0);
    gl.uniform2fv(U.uFogRange, fog?.range ?? NO_FOG_RANGE);
    gl.uniform3fv(U.uCamPos, fog?.camPos ?? eye);
    if (U.uFocus) gl.uniform4fv(U.uFocus, fog?.focus ?? NO_FOCUS);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -4);   // the ground's fire over the stone it lies on
    const camAt = fog?.camPos ?? eye;
    try {
      // SHADOW-CLOAK (AUDIT): FARTHEST FIRST - the list comes nearest first (auraWearers), and a cloak's shadow is laid
      // OVER what is behind it, so the nearer wearer's is laid last; the added looks are the same in any order
      for (let i = list.length - 1; i >= 0; i--) {
        const w = list[i];
        if (!w || !Array.isArray(w.at)) continue;
        gl.uniform3f(U.uAt, w.at[0], w.at[1], w.at[2]);
        gl.uniform1f(U.uSeed, Number.isFinite(w.seed) ? w.seed : 0);
        gl.uniform1f(U.uKindle, Math.max(0, Math.min(1, Number.isFinite(w.kindle) ? w.kindle : 1)));
        const look = auraLookOf(w.aura);   // AEGIS: the fire or the ward, at its own radius and height
        gl.uniform1i(U.uAura, look.kind);
        gl.uniform1f(U.uRingR, look.ringR); gl.uniform1f(U.uFlameH, look.flameH);
        gl.uniform1f(U.uYaw, Number.isFinite(w.yaw) ? w.yaw : 0);   // SHADOW-CLOAK: the facing its opening is at
        const torn = Number.isFinite(w.torn) ? w.torn : -1;
        gl.uniform1f(U.uTorn, torn);   // SHADOW-CLOAK: turned beast, the cloak torn (auraBeastStep)
        const sw = w.swing, pose = w.cape ?? CLOAK_REST_POSE;   // SHADOW-CLOAK: its swing (auraMotionStep) and the body's pose it hangs from (auraCapePose)
        gl.uniform4f(U.uSwing, sw?.x || 0, sw?.z || 0, sw?.lift || 0, sw?.twist || 0);
        gl.uniform4fv(U.uCapeS, pose.shoulders); gl.uniform4fv(U.uCapeH, pose.head);
        gl.uniform3fv(U.uKneeL, pose.kneeL); gl.uniform3fv(U.uKneeR, pose.kneeR);
        const torso = pose.torso ?? CLOAK_REST_POSE.torso;   // SERAPH-WINGS: the back the wings grow from
        gl.uniform3f(U.uTorsoU, torso[0], torso[1], torso[2]); gl.uniform3f(U.uTorsoF, torso[3], torso[4], torso[5]);
        gl.uniform1f(U.uWingBack, Number.isFinite(pose.wingBack) ? pose.wingBack : 0);   // WINGS-FIT: a sprite's wings rooted further back
        // SHADOW-CLOAK: a look that SHADES is drawn premultiplied - its light added, what is behind it covered by its
        // alpha - and every other look as it always was, its light added whole
        if (look.shade) gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.uniform1i(U.uKind, 0);
        gl.bindVertexArray(this.quadVao);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        if (look.mesh === 'cloak') this._drawCloak(w, look, torn, camAt);   // SHADOW-CLOAK: the cloak's cloth, not the strip
        else {
          const wings = look.mesh === 'wings', closed = wings && pose.sunk === true;   // SERAPH-WINGS: the strands, not the strip - and, as the cloak's, none of it with the ground's depth offset; AUDIT 3: closed on a body sunk to its neck
          if (wings) gl.disable(gl.POLYGON_OFFSET_FILL);
          gl.uniform1i(U.uKind, 1);
          gl.bindVertexArray(wings ? this.wingsVao : this.flameVao);
          if (!closed) gl.drawArrays(gl.TRIANGLES, 0, wings ? WING_VERTS : AURA_STEPS * 6);
          if (look.glyphs && !closed) {   // AEGIS: the ward's floating symbols, a third draw; SERAPH-WINGS: the wings' motes
            gl.uniform1i(U.uKind, 2);
            gl.bindVertexArray(this.glyphVao);
            gl.drawArrays(gl.TRIANGLES, 0, look.glyphs * 6);
          }
          if (wings) gl.enable(gl.POLYGON_OFFSET_FILL);
        }
        if (look.shade) gl.blendFunc(gl.ONE, gl.ONE);
        this.drawn++;
      }
    } finally {   // SHADOW-CLOAK (AUDIT): the frame's state handed back whatever a wearer did mid-pass
      gl.bindVertexArray(null);
      gl.cullFace(gl.BACK);
      gl.disable(gl.POLYGON_OFFSET_FILL);
      gl.enable(gl.CULL_FACE);
      gl.depthMask(true);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.disable(gl.BLEND);
    }
  }

  /** SHADOW-CLOAK: THE CLOAK'S CLOTH AND ITS CARDS, after its ground - `eye` the frame's camera. The cloth's two sides are
   *  two draws of its mesh, its lining (`uSide` 0, the faces turned from the eye - front faces culled) and then its
   *  outside (1, back faces culled), so the bent mesh's own winding names each side (the frame's front face is the
   *  game's: world/mat4.js HANDEDNESS mirrors the projection and the renderer winds CW). None of it while torn through,
   *  folded on a rider, or with the eye inside its hood (CLOAK_INSIDE_M - its fragments answer nothing there). Its cards:
   *  the emblems before the cloth when the eye is in front of the wearer (they rise behind them), after it otherwise;
   *  torn, the shreds after it always (they burst out every way) - the shreds alone once through. None of it with the
   *  ground's depth offset, which is the ground's (AUDIT 2: a body before the cloth stays before it). */
  _drawCloak(w, look, torn, eye) {
    const gl = this.gl, U = this.u;
    const folded = w.mounted === true || w.cape?.sunk === true;   // AUDIT 3: and on a body sunk to its neck (auraSpriteBones)
    const dx = eye[0] - w.at[0], dz = eye[2] - w.at[2], yaw = Number.isFinite(w.yaw) ? w.yaw : 0, hd = (w.cape ?? CLOAK_REST_POSE).head, c = Math.cos(yaw), sn = Math.sin(yaw);
    const front = dx * sn + dz * c > 0, emblemsFirst = !folded && front && torn < CLOAK_RIP_S;
    gl.disable(gl.POLYGON_OFFSET_FILL);   // the ground's offset is the ground's
    if (emblemsFirst) { gl.uniform1i(U.uKind, 2); gl.bindVertexArray(this.glyphVao); gl.drawArrays(gl.TRIANGLES, 0, look.glyphs * 6); }
    if (torn < CLOAK_RIP_S && !folded && Math.hypot(dx - c * hd[0] - sn * hd[2], eye[1] - w.at[1] - hd[1], dz + sn * hd[0] - c * hd[2]) >= CLOAK_INSIDE_M) {   // the eye inside the hood (the wearer's own first person) - by the hood's own middle, so a camera over or beside them never is (AUDIT 2)
      gl.uniform1i(U.uKind, 1);
      gl.bindVertexArray(this.cloakVao);
      gl.enable(gl.CULL_FACE);
      for (let side = 0; side < 2; side++) { gl.uniform1i(U.uSide, side); gl.cullFace(side === 0 ? gl.FRONT : gl.BACK); gl.drawArrays(gl.TRIANGLES, 0, CLOAK_ROUND * CLOAK_ROWS * 6); }   // its lining, then its outside over it
      gl.disable(gl.CULL_FACE);
      gl.cullFace(gl.BACK);
    }
    const from = emblemsFirst || torn >= CLOAK_RIP_S ? look.glyphs : 0, to = look.glyphs + (torn >= 0 ? look.shreds : 0);
    if (!folded && to > from) { gl.uniform1i(U.uKind, 2); gl.bindVertexArray(this.glyphVao); gl.drawArrays(gl.TRIANGLES, from * 6, (to - from) * 6); }
    gl.enable(gl.POLYGON_OFFSET_FILL);
  }
}
