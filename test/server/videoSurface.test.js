import assert from 'node:assert/strict';
import {
  videoSurfacesOf, videoSurfaceCmd, clearVideoForPiece, clearVideoForHome,
} from '../../server-account/src/videoSurface.js';
import { VIDEO_PAINTING_TEMPLATE } from '../../src/net/videoSurfaceLaw.js';

function memDb() {
  /** @type {Map<string, any>} */
  const video = new Map();
  /** @type {Map<string, any>} */
  const decor = new Map();
  /** @type {Map<string, any>} */
  const homes = new Map();
  /** @type {Map<string, any>} */
  const realm = new Map();
  const key = (...a) => a.join(':');

  const api = {
    prepare(sql) {
      const s = String(sql);
      return {
        bind(...args) {
          this._args = args;
          return this;
        },
        async first() {
          if (s.includes('INTO rate_limits') || s.includes('FROM rate_limits')) return { count: 1 };
          if (s.includes('AS owns')) {
            const h = homes.get(key(this._args[0], this._args[1]));
            return { owns: h && h.player === this._args[2] ? 1 : 0 };
          }
          if (s.includes('FROM realm_characters')) {
            return realm.get(key(this._args[0], this._args[1])) ?? null;
          }
          if (s.includes('FROM home_decor')) {
            return decor.get(key(this._args[0], this._args[1], this._args[2])) ?? null;
          }
          if (s.includes('FROM home_video_surface') && s.includes('piece_id')) {
            return video.get(key(this._args[0], this._args[1], this._args[2])) ?? null;
          }
          if (s.includes('FROM homes WHERE')) {
            return homes.get(key(this._args[0], this._args[1])) ?? null;
          }
          return null;
        },
        async all() {
          if (s.includes('FROM home_video_surface')) {
            const out = [];
            for (const [k, row] of video) {
              if (k.startsWith(`${this._args[0]}:${this._args[1]}:`)) out.push(row);
            }
            return { results: out };
          }
          return { results: [] };
        },
        async run() {
          if (s.startsWith('DELETE FROM home_video_surface') && this._args.length === 3) {
            video.delete(key(this._args[0], this._args[1], this._args[2]));
            return { meta: { changes: 1 } };
          }
          if (s.startsWith('DELETE FROM home_video_surface') && this._args.length === 2) {
            for (const k of [...video.keys()]) {
              if (k.startsWith(`${this._args[0]}:${this._args[1]}:`)) video.delete(k);
            }
            return { meta: { changes: 1 } };
          }
          if (s.includes('INSERT INTO home_video_surface')) {
            const [mapId, buildingKey, pieceId, provider, sourceId, status, base, started, updated, revision] = this._args;
            const k = key(mapId, buildingKey, pieceId);
            const cur = video.get(k);
            const expectedRev = this._args[this._args.length - 1];
            if (cur && cur.revision !== expectedRev) return { meta: { changes: 0 } };
            video.set(k, {
              map_id: mapId, building_key: buildingKey, piece_id: pieceId,
              provider, source_id: sourceId, status,
              base_position_seconds: base, server_started_at: started,
              updated_at: updated, revision,
            });
            return { meta: { changes: 1 } };
          }
          return { meta: { changes: 1 } };
        },
      };
    },
    _video: video,
    _decor: decor,
    _homes: homes,
    _realm: realm,
  };
  return api;
}

// stub overRate via dynamic — videoSurface imports accounts.overRate; for unit test we avoid hitting D1 rates
// by using a fresh player id and accepting the real import may call overRate. Patch: call with a fake that
// never rate-limits by monkeypatching is hard; instead keep ops under the limit (one call).

const db = memDb();
const CHAR = 'r' + 'a'.repeat(20);
db._homes.set('1001:1', { player: 'player1', char_id: CHAR, guild_id: null });
db._realm.set(`${CHAR}:player1`, { ok: 1 });
db._decor.set('1001:1:abc123def456', {
  item: JSON.stringify({ t: VIDEO_PAINTING_TEMPLATE, g: 9 }),
  yard: 0,
});

const ctx = { db, nowS: 1_700_000_000 };

import { accountKind } from '../../server-account/src/accounts.js';

const linked = { id: 'player1', handle: 'tester', password: 'x', guest_name: null };
assert.equal(accountKind(linked), 'linked');

const listed0 = await videoSurfacesOf(ctx, linked, { mapId: 1001, buildingKey: 1, character: CHAR });
assert.equal(listed0.ok, true);
assert.equal(listed0.surfaces.length, 0);

const bad = await videoSurfaceCmd(ctx, linked, {
  mapId: 1001, buildingKey: 1, character: CHAR, id: 'abc123def456',
  op: 'source', url: 'https://evil.example/x.mp4', rev: 0,
});
assert.equal(bad.error, 'bad-source');

const set = await videoSurfaceCmd(ctx, linked, {
  mapId: 1001, buildingKey: 1, character: CHAR, id: 'abc123def456',
  op: 'source', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', rev: 0,
});
assert.equal(set.ok, true);
assert.equal(set.surface.provider, 'youtube');
assert.equal(set.revision, 1);

const stale = await videoSurfaceCmd(ctx, linked, {
  mapId: 1001, buildingKey: 1, character: CHAR, id: 'abc123def456',
  op: 'play', rev: 0,
});
assert.equal(stale.error, 'video-rev');

const play = await videoSurfaceCmd(ctx, linked, {
  mapId: 1001, buildingKey: 1, character: CHAR, id: 'abc123def456',
  op: 'play', rev: 1,
});
assert.equal(play.ok, true);
assert.equal(play.surface.status, 'playing');

const listed = await videoSurfacesOf(ctx, linked, { mapId: 1001, buildingKey: 1, character: CHAR });
assert.equal(listed.surfaces.length, 1);

await clearVideoForPiece(db, 1001, 1, 'abc123def456');
assert.equal((await videoSurfacesOf(ctx, linked, { mapId: 1001, buildingKey: 1, character: CHAR })).surfaces.length, 0);

await videoSurfaceCmd(ctx, linked, {
  mapId: 1001, buildingKey: 1, character: CHAR, id: 'abc123def456',
  op: 'source', url: 'https://youtu.be/dQw4w9WgXcQ', rev: 0,
});
await clearVideoForHome(db, 1001, 1);
assert.equal((await videoSurfacesOf(ctx, linked, { mapId: 1001, buildingKey: 1, character: CHAR })).surfaces.length, 0);

const stranger = await videoSurfaceCmd(ctx, { id: 'other', handle: 'x', password: 'x', guest_name: null }, {
  mapId: 1001, buildingKey: 1, character: CHAR, id: 'abc123def456',
  op: 'source', url: 'https://youtu.be/dQw4w9WgXcQ', rev: 0,
});
assert.ok(stranger.error === 'decor-shut' || stranger.error === 'realm-only');

console.log('videoSurface server: ok');
