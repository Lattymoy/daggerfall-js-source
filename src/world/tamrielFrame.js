// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TAMRIEL1 (2026-10-08, bible/03-World/Tamriel.md) - THE FRAME: one grid that holds the whole of Tamriel, with
// Daggerfall's own 1000 x 500 map standing in it at the map's own scale, unchanged.
//
// Mac: "building the entirety of tamriel that connects accurately to Daggerfall. Not actually traversalable but used
// and connected as a gigantic map that can be used for later use and be seen by players ingame."
//
// THE ONE LAW. A Daggerfall map pixel is 819.2 m of ground (MapsFile: 32768 world units a pixel, 40 a metre -
// net/wire.js PIXEL_UNITS), and a Tamriel pixel is the SAME 819.2 m: the continent is not a picture scaled to fit a
// sheet, it is the Bay's own grid extended until the continent fits on it. So a point of the Bay is a point of Tamriel
// by ONE offset (BAY_ORIGIN) and no scale, and every coordinate the game already keeps - a pixel, a pose, a mark -
// stays what it was. Nothing beyond the Bay's rectangle is walked, travelled or streamed: the frame is a map's
// geography, and the room the later use needs (a place, a region, a road laid outside the Bay has a pixel to stand on).
//
// THE PICTURE GRID. The continent is AUTHORED on Daggerfall's own Tamriel picture's grid - TMAP00I0.IMG is 320 x 200
// (CreateCharRaceSelect's background; ui/provinceMap.js MAP_W/MAP_H read its picker the same way) - at
// PIXELS_PER_PICTURE_UNIT Bay pixels a picture pixel, so one picture pixel is 15.36 km and the continent is
// 6000 x 3750 Bay pixels: 4,915 km by 3,072 km. The outlines are OURS (world/tamrielGeography.js): a picture of the
// game's is game data (Port-Doctrine, A RENDER OF GAME DATA IS GAME DATA) and nothing of TMAP00I0 ships; the grid is
// borrowed so the authored shape can be laid over the player's own picture by a local probe (tools/tamrielFitProbe.mjs)
// and corrected against it, number by number.
//
// WHAT IS MEASURED AND WHAT IS AUTHORED. The scale (819.2 m a pixel) is MapsFile's and measured. The picture's size is
// the file's and measured. The continent's size in Bay pixels follows from the two by one authored ratio
// (PIXELS_PER_PICTURE_UNIT), and the Bay's place in it (BAY_ORIGIN) is authored from the lore map's reading - the Bay
// is the notch between High Rock and Hammerfell on the west coast, about a sixth of the way across and a quarter down -
// until the probe has been run on a real TMAP00I0 and the two numbers are corrected from it. Both are named here and
// nowhere else; every consumer converts through the functions below.
// ═══════════════════════════════════════════════════════════════════

import { MAP_WIDTH, MAP_HEIGHT } from '../formats/woodsFile.js';
/** The kilometres a map pixel spans - MapsFile's own 32768 world units at 40 a metre (world/streamingWorld.js
 *  NATIVE_PIXEL; net/wire.js PIXEL_UNITS; net/gateLaw.js PIXEL_M, the metres). Measured, not chosen, and held to the
 *  wire's units by test/tamriel.test.js. Not imported from the gate's law: the terrain worker reads this module, and its
 *  import graph is pure by law (TAMRIEL2-WORKER: that import dragged net/wire.js and twenty modules into the worker's
 *  bundle, and the world froze on going outside). */
/** The authoring grid: Daggerfall's Tamriel picture, 320 x 200 (TMAP00I0.IMG, TAMRIEL2.IMG - ui/provinceMap.js). */
export const PICTURE_W = 320;
export const PICTURE_H = 200;
/** Bay pixels a picture pixel. AUTHORED: the one ratio that sizes the continent on the Bay's grid. At 18.75 the Bay's
 *  1000 pixels are 53.3 picture pixels - a sixth of the picture's width - which is the Bay's share of the lore map. */
export const PIXELS_PER_PICTURE_UNIT = 18.75;
/** The continent's grid, in Bay pixels (819.2 m each). */
export const TAMRIEL_W = PICTURE_W * PIXELS_PER_PICTURE_UNIT;   // 6000
export const TAMRIEL_H = PICTURE_H * PIXELS_PER_PICTURE_UNIT;   // 3750
/** The Bay's own map, as the frame knows it: WOODS.WLD's 1000 x 500. */
export const BAY_W = MAP_WIDTH;
export const BAY_H = MAP_HEIGHT;
/** Where the Bay's pixel (0, 0) stands on the continent's grid, in Tamriel pixels. AUTHORED (header): picture
 *  (45.97, 52.0) - the west coast's notch, under northern High Rock, over Hammerfell's shoulder - and the DEFAULT: at
 *  boot the fit (world/tamrielLand.js fitBayToPicture, over the player's own picture) replaces it and the scale
 *  through setTamrielFit, and every conversion below reads the live pair. */
export const BAY_ORIGIN = Object.freeze({ x: 862, y: 975 });

/** TAMRIEL3: THE LIVE FIT - the Bay's origin (Tamriel pixels) and the scale (Bay pixels a picture pixel) every
 *  conversion reads. The authored defaults until the world host installs the picture's own (the worker is handed the
 *  same pair). `null` puts the defaults back. */
let _fit = { ox: BAY_ORIGIN.x, oy: BAY_ORIGIN.y, ppu: PIXELS_PER_PICTURE_UNIT };
export function setTamrielFit(fit) {
  _fit = fit && Number.isFinite(fit.ox) && Number.isFinite(fit.oy) && fit.ppu > 0
    ? { ox: fit.ox, oy: fit.oy, ppu: fit.ppu }
    : { ox: BAY_ORIGIN.x, oy: BAY_ORIGIN.y, ppu: PIXELS_PER_PICTURE_UNIT };
}
export const tamrielFit = () => _fit;
/** The continent's grid at the live scale, Bay pixels. */
export const tamrielSize = () => ({ w: PICTURE_W * _fit.ppu, h: PICTURE_H * _fit.ppu });

export const KM_PER_PIXEL = 0.8192;

/** A Bay pixel's place on the continent's grid. Fractions allowed: a point, not only a pixel. */
export function bayToTamriel(x, y) {
  return [x + _fit.ox, y + _fit.oy];
}
/** A point of the continent's grid in the Bay's own coordinates (negative west and north of the Bay). */
export function tamrielToBay(tx, ty) {
  return [tx - _fit.ox, ty - _fit.oy];
}
/** A picture-grid point (the authoring grid, 320 x 200) in the Bay's coordinates - what the held map draws in. */
export function pictureToBay(px, py) {
  return [px * _fit.ppu - _fit.ox, py * _fit.ppu - _fit.oy];
}
/** A Bay-coordinate point on the picture grid - the inverse of pictureToBay. */
export function bayToPicture(x, y) {
  return [(x + _fit.ox) / _fit.ppu, (y + _fit.oy) / _fit.ppu];
}
/** Is a Bay-coordinate point on the Bay's own map - the data's ground, where nothing authored is drawn? */
export function inBay(x, y) {
  return x >= 0 && y >= 0 && x < BAY_W && y < BAY_H;
}
/** The Bay's rectangle on the picture grid: {x0, y0, x1, y1}, picture units. */
export function bayPictureRect() {
  const [x0, y0] = bayToPicture(0, 0);
  const [x1, y1] = bayToPicture(BAY_W, BAY_H);
  return { x0, y0, x1, y1 };
}
/** The whole frame in the Bay's coordinates: the box the held map may pan over when it shows the continent -
 *  {x0, y0, w, h}, with the Bay at (0, 0)..(BAY_W, BAY_H) inside it. */
export function tamrielFrameInBay() {
  const [x0, y0] = tamrielToBay(0, 0);
  const { w, h } = tamrielSize();
  return { x0, y0, w, h };
}
/** A length on the grid in kilometres - the continent's width, say. */
export const pixelsToKm = (px) => px * KM_PER_PIXEL;
