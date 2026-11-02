// @ts-check
// AUDIT FB1031 W1 W3 W4 (2026-10-31;, WITNESS-TILES): THE
// HELD MAP'S WITNESSED GROUND, LAID ONCE A UTC DAY IN TILES. WITNESS-MAP read a region's ground through the writ board's
// ten-minute keep, so most asks scanned the region's witness rows, and a province or the sea past the Bay was cut at
// 8,192 pixels. The map never scans world_witness now: the day's Motherlodes pick already reads every pixel confirmed
// before the day began, and its batch lays them as tiles (net/witnessTileLaw.js); a day picked before them (the deploy's)
// is laid by the minute's job with its own scan. The map reads tiles by their keys.
import { mintId } from './accounts.js';
import { profAsks, profShut } from './professions.js';
import { readAll } from './service.js';
import { utcDay } from '../../src/net/marksLaw.js';
import { pixelOk } from '../../src/net/nodeLaw.js';
import { WITNESS_TILES_ASK, tileOk, tileOf, tileKey, packTile } from '../../src/net/witnessTileLaw.js';

/** The characters of pixels one laying statement binds at most (each row's key rides beside them - AUDIT FB1031 II T5) - a
 *  full tile is 8,192, D1's bound string 2 MB. */
export const TILES_LAID_CHARS = 100_000;

/**
 * THE STATEMENTS THAT LAY `day` (`{ statements, tiles }`): its mark (the tiles' and pixels' counts, under the nonce `n`),
 * each tile holding a pixel of `ground` (`[{ x, y }]`, every pixel confirmed before the day began), and every earlier
 * day's tiles and marks dropped - each written only under the mark THIS laying made, so two racing layings keep one.
 * @param {any} db @param {number} day @param {ReadonlyArray<{ x: number, y: number }>} ground @param {string} n
 */
export function witnessTileStatements(db, day, ground, n) {
  const tiles = new Map();
  for (const p of ground) {
    if (!pixelOk(p?.x, p?.y)) continue;
    const [tx, ty] = tileOf(p.x, p.y);
    const k = tileKey(tx, ty);
    if (!tiles.has(k)) tiles.set(k, { tx, ty, pixels: [] });
    tiles.get(k).pixels.push([p.x, p.y]);
  }
  const rows = [...tiles.values()].map((t) => [t.tx, t.ty, packTile(t.tx, t.ty, t.pixels)]);
  const chunks = [];
  let chunk = [], chars = 0;
  for (const r of rows) {
    if (chunk.length && chars + r[2].length > TILES_LAID_CHARS) { chunks.push(chunk); chunk = []; chars = 0; }
    chunk.push(r);
    chars += r[2].length;
  }
  if (chunk.length) chunks.push(chunk);
  const laid = 'EXISTS (SELECT 1 FROM witness_tile_days WHERE day = ?1 AND n = ?2)';
  const statements = [
    db.prepare('INSERT OR IGNORE INTO witness_tile_days (day, tiles, pixels, n) VALUES (?1, ?2, ?3, ?4)')
      .bind(day, rows.length, rows.reduce((s, r) => s + r[2].length / 2, 0), n),
    ...chunks.map((c) => db.prepare(`INSERT OR IGNORE INTO witness_tiles (day, tx, ty, px)
      SELECT ?1, json_extract(j.value, '$[0]'), json_extract(j.value, '$[1]'), json_extract(j.value, '$[2]') FROM json_each(?3) AS j WHERE ${laid}`)
      .bind(day, n, JSON.stringify(c))),
    db.prepare(`DELETE FROM witness_tiles WHERE day < ?1 AND ${laid}`).bind(day, n),
    db.prepare(`DELETE FROM witness_tile_days WHERE day < ?1 AND ${laid}`).bind(day, n),
  ];
  return { statements, tiles: rows.length };
}

/**
 * THE MINUTE'S LAYING (cron.js): `day`'s tiles where nothing laid them - one read while it is laid; else `scan()` (the
 * pick's own, motherlodes.js confirmedGroundBefore) and the laying. Answers the tiles laid.
 * @param {{ db: any, rand: (b: Uint8Array) => void }} ctx @param {number} day
 * @param {() => Promise<ReadonlyArray<{ x: number, y: number }>>} scan
 */
export async function layWitnessTiles({ db, rand }, day, scan) {
  if (await db.prepare('SELECT 1 FROM witness_tile_days WHERE day = ?1').bind(day).first()) return 0;
  const { statements, tiles } = witnessTileStatements(db, day, await scan(), mintId(rand));
  await db.batch(statements);
  return tiles;
}

/** The tiles an ask names, each once - null for anything but 1..WITNESS_TILES_ASK tiles of the world's grid. */
function tilesAsked(tiles) {
  if (!Array.isArray(tiles) || tiles.length < 1 || tiles.length > WITNESS_TILES_ASK) return null;
  const out = new Map();
  for (const t of tiles) {
    if (!Array.isArray(t) || t.length !== 2 || !tileOk(t[0], t[1])) return null;
    out.set(tileKey(t[0], t[1]), [t[0], t[1]]);
  }
  return [...out.values()];
}

/**
 * THE MAP'S READ (`POST /v1/prof/ground { character, tiles: [[tx, ty]...] }`): today's tiles of those asked that hold
 * ground, `{ day, laid: true, tiles: [[tx, ty, px]...] }` - a tile asked and not answered holds none - or `{ day, laid:
 * false }` before the day is laid (the client asks again later; nothing here lays or scans). Two primary-key reads in
 * one round trip, on a replica (service.js REPLICA_ROUTES): it writes nothing and keeps nothing an isolate shares.
 */
export async function profGround({ db, nowS }, player, env, { character, tiles } = {}) {
  const refused = profAsks(player, { character, needRid: false }) ?? profShut(player, env);
  if (refused) return refused;
  const asked = tilesAsked(tiles);
  if (!asked) return { error: 'bad-pixels' };   // the pixels' own word: the client has its sentence
  const day = utcDay(nowS);
  const [mark, rows] = await readAll(db, [
    db.prepare('SELECT 1 AS laid FROM witness_tile_days WHERE day = ?1').bind(day),
    db.prepare(`SELECT t.tx, t.ty, t.px FROM json_each(?2) AS j CROSS JOIN witness_tiles AS t
      WHERE t.day = ?1 AND t.tx = json_extract(j.value, '$[0]') AND t.ty = json_extract(j.value, '$[1]')`).bind(day, JSON.stringify(asked)),
  ]);
  if (!mark.length) return { day, laid: false };
  return { day, laid: true, tiles: rows.map((r) => [Number(r.tx), Number(r.ty), String(r.px)]) };
}
