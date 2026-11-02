// INTRO2. Seconds in the DECODED recording, not an approximate tempo grid.
// tools/introAudioCheck.mjs reproduces these landmarks from the shipped MP3.
// There is no capture correction or arbitrary lead.
//
// INTRO2b (Mac, 2026-09-18: "the logo needs to drop with the beat that
// happens around the 19 second mark"). The first cut landed on 20.533333s,
// which is only the loudest FRAME inside a hand-picked 20.35-20.7s window -
// it is not a local maximum of the onset curve at all, and the ear hears no
// attack there. The beat Mac means is the real one: decoded sample 230016,
// normalized flux 1.77 and the largest raw onset anywhere between the cloud
// break and the closing pair. The louder answer at 21.066667s still follows
// it, and is still deliberately ignored.
//
// Measured on the REMASTERED master Mac supplied on the same day, which is a
// different recording (164.3335s, not 164.5202s) carrying the same
// arrangement. Its cloud break is still 11.712s; its 19s beat moved one
// analysis hop earlier than the old master's, and the cue moved with it.
//
// INTRO4 (2026-10-26, the owner: "Overhaul the main intro sequence to be more in line with the elder scrolls game
// oblivion and still zoom out into the entire map of tamriel. Utilize the imperial city we have built for this. I want
// this to be as detailed as possible"; bible/10-UI/UI-Arc.md INTRO4). THE FILM IS LONGER, ON THE SAME RECORDING. Its
// bars measured off the decoded master (tools/introAudioCheck.mjs, the same flux): 1.888 s a bar from the 19 s beat,
// phrases of eight - so the film cuts on the recording's own downbeats. Pre-dawn over Lake Rumare under the credits; the
// mist breaks on 11.712 and the camera cranes over Talos Bridge's gate and up the White-Gold Tower; on the 19 s beat it
// crests the Tower as the sun clears it (INTRO2b's beat, now CREST_TIME); an orbit of the wheel; on bar 4 a dive over
// the Arena District; on bar 8 the long ascent - the city to Cyrodiil to the whole of Tamriel; the map's words on bar 14;
// and the mark lands on bar 16 (49.344 s), the third phrase's downbeat. A narrator's five lines run under it, the way
// Oblivion's opening speaks over its Imperial City - the words the port's own.
import { t } from '../../systems/textManager.js';   // L10N4: the credits' captions in the player's language
import { tamrielCentre, tamrielSpan } from './introTamriel.js';

/** The recording's landmarks (decoded sample / 12000 Hz - tools/introAudioCheck.mjs measures each). */
export const CLOUD_REVEAL_TIME = 11.712;
/** INTRO2b's 19 s beat: INTRO2's logo landed here; INTRO4's camera crests the White-Gold Tower on it. */
export const CREST_TIME = 230016 / 12000;
/** Bar 4 after it: the dive over the districts. */
export const DISTRICTS_TIME = 320512 / 12000;
/** Bar 8, the second phrase: the ascent. */
export const ASCENT_TIME = 410880 / 12000;
/** Bar 14: the map's words. */
export const MAP_TIME = 546816 / 12000;
/** Bar 16, the third phrase's downbeat: the mark lands. */
export const TITLE_IMPACT_TIME = 592128 / 12000;
export const TITLE_ENTER_TIME = TITLE_IMPACT_TIME - 0.78;
export const TITLE_READY_TIME = TITLE_IMPACT_TIME + 1.35;
export const MENU_FADE_SECONDS = 1.1;
export const INTRO_HOLD_TIME = TITLE_IMPACT_TIME + 2.4;
// The camera must be at rest BEFORE the logo starts moving, so the landing is
// the only movement on the beat - the same 0.85s of stillness ahead of TITLE_ENTER_TIME INTRO2b kept.
export const LANDSCAPE_HOLD_TIME = TITLE_ENTER_TIME - 0.85;

const unit = (x) => Math.max(0, Math.min(1, x));
export const introEase = (x) => { const k = unit(x); return k * k * k * (k * (k * 6 - 15) + 10); };
const between = (t, a, b) => introEase((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const rad = (d) => (d * Math.PI) / 180;

// L10N4: each caption is read when the film draws it, in the player's language (a getter - the table is built at load)
export const INTRO_CREDITS = Object.freeze([
  Object.freeze({ key: 'interkarma', get caption() { return t('menu.intro.creditInterkarma', 'Built on the work of'); }, start: 1.25, up: 2.25, out: 4.55, end: 5.3 }),
  Object.freeze({ key: 'nexus', get caption() { return t('menu.intro.creditNexus', 'With the modding community of'); }, start: 5.65, up: 6.6, out: 8.5, end: 9.3 }),
]);

export function introCreditOpacity(credit, time) {
  return between(time, credit.start, credit.up) * (1 - between(time, credit.out, credit.end));
}

/** INTRO4: THE NARRATOR - five lines over the flight, each up while its shot holds and gone before the next cut, none
 *  over a credit or the mark. The words are the port's own (3E 405: Uriel Septim VII on the throne, Lysandus dead at
 *  Cryngaine Field, the Numidium sunk in the Bay), in the player's language. */
export const INTRO_NARRATION = Object.freeze([
  Object.freeze({ key: 'narration1', get text() { return t('menu.intro.narration1', 'Four hundred and five years since Tiber Septim forged the Empire, Tamriel endures.'); }, start: 12.25, up: 12.95, out: 17.65, end: 18.4 }),
  Object.freeze({ key: 'narration2', get text() { return t('menu.intro.narration2', 'From the White-Gold Tower, the Emperor holds nine provinces as one.'); }, start: 20.05, up: 20.75, out: 25.35, end: 26.1 }),
  Object.freeze({ key: 'narration3', get text() { return t('menu.intro.narration3', 'But in the west, a murdered king walks the streets of Daggerfall, and the Iliac Bay drifts toward war.'); }, start: 27.05, up: 27.75, out: 33.05, end: 33.8 }),
  Object.freeze({ key: 'narration4', get text() { return t('menu.intro.narration4', 'Beneath its waters, a power that once broke kingdoms waits for a hand to wake it.'); }, start: 35.0, up: 35.7, out: 40.1, end: 40.85 }),
  Object.freeze({ key: 'narration5', get text() { return t('menu.intro.narration5', 'Nine provinces. A thousand roads. The story of this age is yours to write.'); }, start: 41.6, up: 42.3, out: 46.85, end: 47.6 }),
]);

export function introNarrationOpacity(line, time) {
  return between(time, line.start, line.up) * (1 - between(time, line.out, line.end));
}

/** INTRO2c (Mac: "I want the logo to fly in from the screen, not from the top
 * of the screen. If that makes sense. Needs to feel powerful, not goofy").
 *
 * The mark no longer drops in from above. It comes out of the DEPTH of the
 * shot, dead centre on the camera axis, and stops on the beat.
 *
 * The apparent size of something travelling at a CONSTANT speed toward a lens
 * is 1/z, so a linear sweep of z from TITLE_DEPTH to 1 is the real thing: far
 * and almost still for most of the approach, then filling the frame over the
 * last few frames. An eased size ramp is exactly what reads as goofy, and so
 * does an overshoot - this has neither. The mark stops dead at 1, and the
 * recoil belongs to the WORLD (impact: bloom and a settling frame), not to a
 * bouncing wordmark. Depth of field closes with the distance, so it resolves
 * as it arrives instead of sliding in already sharp.
 *
 * y stays 0 at every time: the entrance has no vertical component at all. */
export const TITLE_DEPTH = 5.5;
export const TITLE_BLUR = 7;
export function introTitleAt(time, reducedMotion = false) {
  // Reduced motion keeps the musical reveal and nothing that flies.
  if (reducedMotion) return { opacity: time < TITLE_IMPACT_TIME ? 0 : 1, y: 0, scale: 1, blur: 0, impact: 0 };
  if (time < TITLE_ENTER_TIME) return { opacity: 0, y: 0, scale: 1 / TITLE_DEPTH, blur: TITLE_BLUR, impact: 0 };
  if (time < TITLE_IMPACT_TIME) {
    const k = unit((time - TITLE_ENTER_TIME) / (TITLE_IMPACT_TIME - TITLE_ENTER_TIME));
    const z = TITLE_DEPTH - (TITLE_DEPTH - 1) * k;
    return { opacity: between(k, 0, 0.16), y: 0, scale: 1 / z, blur: TITLE_BLUR * (z - 1) / (TITLE_DEPTH - 1), impact: 0 };
  }
  return { opacity: 1, y: 0, scale: 1, blur: 0, impact: Math.exp(-(time - TITLE_IMPACT_TIME) * 8) };
}

// ── THE FLIGHT ─────────────────────────────────────────────────────
//
// Metres in the city's own frame (world/imperialCity.js): its middle on its ground, x east, y up, z south. A bearing
// is clockwise from north, as the city's own `polar` reads one. The Tower stands at the origin (its crown 988-1096 m,
// its spire to 1360), the city wall at 1950 m, Talos Bridge west on bearing 270 to the far shore at 2760, the
// Colosseum east (bearing 90, 1390 m), the Talos statue on the bridge's line at 1390. test/ui/intro.test.js holds every
// frame of this path clear of the landmarks' own measures (IMPERIAL).

const at = (b, r, y) => [r * Math.sin(rad(b)), y, -r * Math.cos(rad(b))];

/** The keyed shots up to the ascent: [time, eye, aim, horizontal field of view]. */
export const INTRO_KEYS = Object.freeze([
  // pre-dawn over the far shore and onto the water, beside the bridge, the Tower a silhouette against the first light
  [0, [-3060, 34, -96], [0, 430, 0], 0.98],
  [4.07, [-2862, 24, -92], [0, 520, 0], 0.98],
  [8.0, [-2584, 17, -88], [0, 560, 0], 0.96],
  [CLOUD_REVEAL_TIME, [-2330, 19, -86], [0, 600, 0], 0.95],
  // the mist breaks: over the city wall between the gate's towers and the next, over Talos's dragon, up the Tower's west face
  [12.6, [-2205, 36, -86], [0, 660, 0], 0.96],
  [14.0, [-1985, 112, -84], [0, 760, 0], 0.98],
  [16.6, [-1180, 420, -34], [0, 980, 0], 1.02],
  // the 19 s beat: level with the crown as the sun clears the spire
  [CREST_TIME, [-560, 1290, -170], [0, 1060, 0], 1.06],
  // the orbit: north round the crown, opening onto the wheel of the districts
  [21.5, at(298, 800, 1240), [0, 960, 0], 1.1],
  [24.0, at(342, 1000, 1330), [0, 620, 0], 1.12],
  [DISTRICTS_TIME, at(40, 1120, 1330), [0, 300, 0], 1.12],
  // the dive: down over the Arena District's Colosseum and out across the walls toward the lake
  [29.1, at(64, 1180, 860), [1390, 30, 0], 1.1],
  [31.3, at(82, 1270, 330), at(96, 1850, 20), 1.08],
  [33.0, at(88, 1720, 190), at(80, 2600, 40), 1.08],
  [ASCENT_TIME, at(85, 2060, 175), at(75, 2900, 60), 1.1],
]);

/** Non-uniform Catmull-Rom through the keys' `field` (1 eye, 2 aim, 3 fov), C1 at every key; the last key's tangent
 *  the ascent's opening velocity. */
function keyed(time, field) {
  const K = INTRO_KEYS;
  let i = 0;
  while (i < K.length - 2 && time > K[i + 1][0]) i++;
  const t0 = K[i][0], t1 = K[i + 1][0], h = t1 - t0, s = unit((time - t0) / h);
  const v = (k) => K[k][field];
  const tangent = (k) => {
    const a = Math.max(0, k - 1), b = Math.min(K.length - 1, k + 1);
    const pa = v(a), pb = v(b), dt = K[b][0] - K[a][0];
    return Array.isArray(pa) ? pa.map((q, j) => (pb[j] - q) / dt) : (pb - pa) / dt;
  };
  const h00 = 2 * s ** 3 - 3 * s ** 2 + 1, h10 = s ** 3 - 2 * s ** 2 + s, h01 = -2 * s ** 3 + 3 * s ** 2, h11 = s ** 3 - s ** 2;
  const p0 = v(i), p1 = v(i + 1), m0 = tangent(i), m1 = tangent(i + 1);
  if (!Array.isArray(p0)) return h00 * p0 + h10 * h * m0 + h01 * p1 + h11 * h * m1;
  return p0.map((q, j) => h00 * q + h10 * h * m0[j] + h01 * p1[j] + h11 * h * m1[j]);
}

/** The last frame: north up, looking down at the middle of the land from the south, the whole of it in frame. */
export const MAP_PITCH = rad(-78);
export const MAP_FOV = 1.04;
/** How far the last frame stands from the land's middle - all of it between the letterbox's bars, its width held on a
 *  narrow screen and its height on a wide one. */
export function mapDistance(aspect = 16 / 9) {
  const [w, h] = tamrielSpan();
  const halfV = Math.tan(MAP_FOV / 2) / Math.max(0.45, aspect);
  return 0.93 * Math.max((w * 0.56) / Math.tan(MAP_FOV / 2), (h * 0.62) / (halfV * 0.89));
}

const forward = (yaw, pitch) => [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
const dirOf = (eye, aim) => { const d = aim.map((q, j) => q - eye[j]), l = Math.hypot(...d); return d.map((q) => q / l); };

/**
 * THE ASCENT (bar 8 to the hold): from the dive's last frame the camera climbs - slowly, the city still under it, then
 * through the cloud and away, Cyrodiil, then the continent - turning north and down as it goes, its aim swinging back
 * over the city's wheel and then out to the land's middle. The climb is even in the logarithm of the distance (each
 * second a like multiple), eased at both ends; the dive's own speed carries into the first second, so there is no stop
 * at the cut.
 */
function ascent(time, aspect) {
  const T0 = ASCENT_TIME, T1 = LANDSCAPE_HOLD_TIME, u = unit((time - T0) / (T1 - T0)), dt = Math.max(0, time - T0);
  const K = INTRO_KEYS[INTRO_KEYS.length - 1], K1 = INTRO_KEYS[INTRO_KEYS.length - 2];
  const eye0 = K[1], dir0 = dirOf(eye0, K[2]);
  const yaw0 = Math.atan2(dir0[0], -dir0[2]), pitch0 = Math.asin(dir0[1]);
  const D0 = eye0[1] / Math.sin(-pitch0), D1 = mapDistance(aspect);
  const ground0 = eye0.map((q, j) => q + dir0[j] * D0);
  // the dive's velocity, coasting out over 1.5 s
  const v0 = eye0.map((q, j) => (q - K1[1][j]) / (K[0] - K1[0])), tau = 1.5, coast = tau * (1 - Math.exp(-dt / tau));
  const climb = introEase(u);
  const D = Math.exp(lerp(Math.log(D0), Math.log(D1), climb));
  const yaw = lerp(yaw0, 0, introEase(u / 0.62));
  const pitch = lerp(pitch0, rad(-64), introEase(u / 0.5)) + (MAP_PITCH - rad(-64)) * introEase((u - 0.4) / 0.6);
  // the aim: back over the city, then out to the land's middle as the continent fills the frame
  const [cx, cz] = tamrielCentre();
  const toCity = introEase(u / 0.42), toLand = introEase((climb - 0.55) / 0.42);
  const aim = [lerp(lerp(ground0[0], 0, toCity), cx, toLand) + v0[0] * coast, 0, lerp(lerp(ground0[2], 0, toCity), cz, toLand) + v0[2] * coast];
  const f = forward(yaw, pitch);
  const eye = aim.map((q, j) => q - f[j] * D);
  return { eye, aim, hfov: lerp(K[3], MAP_FOV, introEase(u)) };
}

/** One perspective camera, the whole film: keyed shots to the ascent, the ascent to the hold, held after. A portrait
 *  screen widens vertically, keeping the shot's width. Reduced motion holds the last frame throughout. */
export function introCameraAt(time, aspect = 16 / 9, reducedMotion = false) {
  const tt = reducedMotion ? LANDSCAPE_HOLD_TIME : Math.max(0, Math.min(LANDSCAPE_HOLD_TIME, time));
  let eye, aim, hfov;
  if (tt < ASCENT_TIME) { eye = keyed(tt, 1); aim = keyed(tt, 2); hfov = keyed(tt, 3); }
  else ({ eye, aim, hfov } = ascent(tt, aspect));
  const fov = 2 * Math.atan(Math.tan(hfov / 2) / Math.max(0.45, aspect));
  return { eye, aim, fov };
}

/** THE MORNING: the sun's elevation (radians) and bearing over the film - below the horizon under the credits, rising
 *  behind the Tower as the mist breaks, clearing its spire on the 19 s beat, a low gold sun through the flight. */
export function introSunAt(time) {
  const tt = Math.max(0, Math.min(LANDSCAPE_HOLD_TIME, time));
  // up through the horizon as the mist breaks, quickest just after (low and gold at the crest), then on into the morning
  const rise = unit((tt - CLOUD_REVEAL_TIME) / (ASCENT_TIME - CLOUD_REVEAL_TIME));
  const elevation = rad(-7 + 7.4 * unit(tt / CLOUD_REVEAL_TIME) ** 1.6 + 9.5 * (1 - (1 - rise) ** 2) + lerp(0, 14, introEase((tt - ASCENT_TIME) / (LANDSCAPE_HOLD_TIME - ASCENT_TIME))));
  return { elevation, bearing: rad(lerp(84, 96, tt / LANDSCAPE_HOLD_TIME)) };
}

/** The cloud deck's band (metres): the ascent passes through it. */
export const CLOUD_DECK = Object.freeze([2600, 3700]);

const smoothRange = (a, b, v) => { const k = unit((v - a) / (b - a)); return k * k * (3 - 2 * k); };
const mix3 = (a, b, k) => a.map((q, j) => q + (b[j] - q) * k);

/** THE AIR over the film, at a time: the sun (a unit vector toward it, its light), the sky's light and the ground's,
 *  how much of the night is left (the stars, the city's lit windows), the lake's mist, the haze, the cloud deck and the
 *  continent's clouds, the map's ink and the Imperial City's mark, the grade's warmth at the end and the flare on the
 *  19 s beat. Linear light; the renderer's own scale. */
export function introAtmosphereAt(time) {
  const tt = Math.max(0, Math.min(LANDSCAPE_HOLD_TIME, time));
  const { elevation, bearing } = introSunAt(tt);
  const e = Math.sin(elevation);
  const sun = [Math.sin(bearing) * Math.cos(elevation), e, -Math.cos(bearing) * Math.cos(elevation)];
  const tint = mix3([1.0, 0.36, 0.13], [1.0, 0.82, 0.63], smoothRange(0.0, 0.34, e));
  const sunCol = tint.map((q) => q * 2.35 * smoothRange(-0.03, 0.12, e));
  const day = smoothRange(-0.16, 0.3, e);
  return {
    sun, sunCol,
    skyAmb: mix3([0.01, 0.014, 0.032], [0.19, 0.25, 0.35], day),
    groundAmb: mix3([0.004, 0.004, 0.006], [0.08, 0.07, 0.05], day),
    night: 1 - between(tt, 9.5, 22),
    mist: 0.1 + 0.9 * (1 - between(tt, 11.9, 17.5)),
    fogA: lerp(1 / 14000, 1 / 32000, day),
    fogH: 1700,
    cirrus: 0.8,
    deck: 0.55,
    clouds: 0.6 - 0.42 * between(tt, MAP_TIME - 3.5, MAP_TIME + 1),
    borders: between(tt, MAP_TIME - 0.6, MAP_TIME + 1.4),
    marker: between(tt, MAP_TIME, MAP_TIME + 1.2),
    warm: 0.8 * between(tt, MAP_TIME - 1.5, MAP_TIME + 2),
    flare: Math.exp(-(((tt - CREST_TIME) / 0.45) ** 2)),
  };
}

/** The title persists indefinitely. Only the player's action ends the intro. */
export function introFrameAt(time, reducedMotion = false) {
  const tt = Math.max(0, time);
  const held = reducedMotion ? LANDSCAPE_HOLD_TIME : Math.min(tt, LANDSCAPE_HOLD_TIME);
  const eyeY = introCameraAt(held, 16 / 9, reducedMotion).eye[1];
  const inDeck = between(eyeY, CLOUD_DECK[0] - 500, CLOUD_DECK[0] + 300) * (1 - between(eyeY, CLOUD_DECK[1] - 300, CLOUD_DECK[1] + 900));
  return {
    time: tt,
    landscapeTime: held,
    opening: between(tt, 0, 1.5),
    // the mist's white-out at the cloud break (INTRO2's), and the cloud deck as the ascent passes through it
    cloud: Math.max(between(tt, 10.25, 11.35) * (1 - between(tt, CLOUD_REVEAL_TIME, 12.35)), reducedMotion ? 0 : inDeck * 0.55),
    shade: 0.1 + 0.52 * between(tt, LANDSCAPE_HOLD_TIME, TITLE_IMPACT_TIME + 0.25),
    // the map's words, and the provinces' borders inked under them
    labels: reducedMotion ? 1 : between(tt, MAP_TIME, MAP_TIME + 1.6),
    borders: reducedMotion ? 1 : between(tt, MAP_TIME - 0.6, MAP_TIME + 1.4),
    title: introTitleAt(tt, reducedMotion),
    credits: INTRO_CREDITS.map((credit) => ({ ...credit, opacity: introCreditOpacity(credit, tt) })),
    narration: INTRO_NARRATION.map((line) => ({ key: line.key, opacity: introNarrationOpacity(line, tt) })),
    ready: tt >= TITLE_READY_TIME,
    prompt: between(tt, TITLE_READY_TIME, TITLE_READY_TIME + 0.65),
  };
}
