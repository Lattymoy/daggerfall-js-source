#!/usr/bin/env node
// SCALE4h (2026-10-11, the plan's eighth slice - "10k writes, by the metrics"; Mac: "I wanna do every single slice";
// bible/11-Multiplayer/Scale-Arc.md SCALE4h): WHAT ONE PLAYER-HOUR WRITES TO THE ACCOUNT PRIMARY, BY TABLE.
//
//   node tools/hotWritesBench.mjs                    a walker and a fighter, an hour each
//   node tools/hotWritesBench.mjs --xp 40 --renown 20 --minutes 60 --json
//
// The real account Worker (server-account/src/index.js) over node:sqlite with every migration applied
// (test/accountDb.mjs, the pins' own D1), driven on a simulated clock by the client's own constants:
//   - THE HEARTBEAT (SCALE4c) at the Notice Board's pace in a town (net/boardLaw.js BOARD_CACHE_MS), the letterbox and the
//     server's post riding it at theirs (net/mail.js MAIL_POLL_MS, net/postLaw.js POST_POLL_MS), and the play beat at
//     its own (net/playClock.js PLAY_BEAT_S);
//   - THE CHECKPOINT (systems/online/onlineCheckpoint.js ONLINE_CHECKPOINT_MS) of a realm character whose save moved - a
//     walker's idle one at systems/realmSaves.js REALM_IDLE_CHECKPOINT_MS;
//   - A FIGHTER'S RENOWN through the client's own tracker (net/renownTracker.js createRenownTracker), earning --xp a
//     minute (SCALE3's fleet earned 40) at Renown --renown, its answers taken as the host takes them - and, where the
//     tree has it, SCALE4h's coalescing law (renownReportSoon) over the service's own answers.
// Every statement the Worker runs is counted where it runs (the binding, or a D1 session over it), and the rows it
// changed (node:sqlite's total_changes - a table's rows, not D1's index writes too) are charged to its table.
//
// A tree is measured from a snapshot of its commit (`git worktree add <dir> <commit>`, the tool copied in): the
// SCALE4h record's before and after are two runs, one of each. Not in the suite: it measures, and a pin holds the law
// (test/server/scale4h.test.js).
import { isMain } from './lib/isMain.mjs';
import { standService } from '../test/accountDb.mjs';
import { seatRealm, freshSave } from '../test/realmSeat.mjs';
import * as renownTrackerModule from '../src/net/renownTracker.js';
import { renownXpFor, renownForXp } from '../src/net/renown.js';
import { BOARD_CACHE_MS } from '../src/net/boardLaw.js';
import { MAIL_POLL_MS } from '../src/net/mail.js';
import { POST_POLL_MS } from '../src/net/postLaw.js';
import { PLAY_BEAT_S } from '../src/net/playClock.js';
import { ONLINE_CHECKPOINT_MS } from '../src/systems/online/onlineCheckpoint.js';
import { REALM_IDLE_CHECKPOINT_MS } from '../src/systems/realmSaves.js';
import { tableOf } from '../server-account/src/metrics.js';   // the service's own reading of which table a statement writes

const { createRenownTracker, renownAnswer } = renownTrackerModule;
/** SCALE4h's law, where the tree has it - a tree before it reports at the minute's pace. */
const renownReportSoon = /** @type {any} */ (renownTrackerModule).renownReportSoon ?? null;


/** The fake D1 with every statement counted: `tally.statements`, and each table's rows changed in `tally.rows`. */
function counted(db, raw, tally) {
  const changes = () => Number(raw.prepare('SELECT total_changes() AS c').get().c);
  const charge = (sql, fn) => {
    const before = changes();
    tally.statements++;
    const out = fn();
    const after = () => {
      const n = changes() - before;
      const t = tableOf(sql);
      if (t && n > 0) tally.rows[t] = (tally.rows[t] ?? 0) + n;
    };
    if (out && typeof out.then === 'function') return out.then((v) => { after(); return v; });
    after();
    return out;
  };
  const wrapStmt = (st, sql) => new Proxy(st, {
    get(t, k) {
      const v = Reflect.get(t, k);
      if (typeof v !== 'function') return v;
      if (k === 'bind') return (...a) => wrapStmt(v.apply(t, a), sql);
      if (k === 'first' || k === 'all' || k === 'run' || k === 'raw' || k === '_result') return (...a) => charge(sql, () => v.apply(t, a));
      return v.bind(t);
    },
  });
  const wrapDb = (d) => new Proxy(d, {
    get(t, k) {
      const v = Reflect.get(t, k);
      if (k === 'prepare') return (sql) => wrapStmt(v.call(t, sql), sql);
      if (k === 'withSession' && typeof v === 'function') return (...a) => wrapDb(v.apply(t, a));
      return typeof v === 'function' ? v.bind(t) : v;
    },
  });
  return wrapDb(db);
}

/**
 * One player-hour of `role` ('walker' or 'fighter'): `{ requests, statements, rows }` - requests and statements by
 * route, rows changed by table. `xp` a fighter's XP a minute, `renown` the Renown it fights at.
 */
export async function playerHour({ role = 'fighter', minutes = 60, xp = 40, renown = 20 } = {}) {
  const realNow = Date.now;
  let simMs = 1_800_000_000_000;
  Date.now = () => simMs;
  try {
    const S = await standService();
    const who = await S.registered('Benched', { renown });
    const R = await seatRealm(S.env, who.secret, 'Benched');
    if (renown > 1) S.env.DB._raw.prepare('INSERT OR REPLACE INTO renown_tracks (player, char_id, name, xp, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(who.id, R.id, 'Benched', renownXpFor(renown), 0, 0);
    const tally = { statements: 0, rows: /** @type {Record<string, number>} */ ({}) };
    S.env.DB = counted(S.env.DB, S.env.DB._raw, tally);
    const byRoute = /** @type {Record<string, { requests: number, statements: number, rows: number }>} */ ({});
    const route = async (label, fn) => {
      const s0 = tally.statements, r0 = Object.values(tally.rows).reduce((a, b) => a + b, 0);
      const out = await fn();
      const e = byRoute[label] ??= { requests: 0, statements: 0, rows: 0 };
      e.requests++; e.statements += tally.statements - s0; e.rows += Object.values(tally.rows).reduce((a, b) => a + b, 0) - r0;
      return out;
    };
    // the fighter's Renown, as the host keeps it (scenes/world.js): the track's total and level the service last said,
    // and (SCALE4h) the hour's room it said with them
    let level = renown, total = renownXpFor(renown), room = null, roomHour = null, cappedHour = null, sentHour = null;
    const hourOf = () => Math.floor(simMs / 3_600_000);
    // AUDIT SCALE II D-8: when each report went, and for each level risen, when what was earned first completed it and
    // when the report that said so went - the rise's pace, which a count of reports cannot tell
    const reportsAt = /** @type {number[]} */ ([]);
    const earnedAt = /** @type {Map<number, number>} */ (new Map());
    const rises = /** @type {{ level: number, earnedAt: number|null, reportedAt: number }[]} */ ([]);
    const tracker = role === 'fighter' ? createRenownTracker({
      report: async (c, n, name, rid, region) => {
        sentHour = hourOf(); reportsAt.push(simMs);   // AUDIT SCALE II C-3: the hour it went in, as the host keeps it
        const r = await route('/v1/renown/xp', () => S.call('/v1/renown/xp', { character: c, xp: n, name, rid, region }, who.secret));
        return r.status === 200 ? { ok: true, data: r.body } : { ok: false, error: r.body?.error ?? 'server' };
      },
      character: () => R.id,
      now: () => simMs,
      ...(renownReportSoon ? { earning: () => cappedHour !== hourOf() } : {}),   // SCALE4h: the host earns nothing in a spent hour
      onAnswer: (data, sent) => {
        const a = renownAnswer(data, sent, level);
        if (a.xp !== null) total = a.xp;
        if (a.level !== null && a.level > level) { for (let L = level + 1; L <= a.level; L++) rises.push({ level: L, earnedAt: earnedAt.get(L) ?? null, reportedAt: simMs }); level = a.level; }
        if (/** @type {any} */ (a).room != null) { room = /** @type {any} */ (a).room; roomHour = hourOf(); }
        if (a.capped && sentHour === hourOf()) cappedHour = hourOf();   // AUDIT SCALE II C-3: the sent hour's cap, as the host keeps it
      },
      // AUDIT SCALE II C-4: and the hour's last minute (`hourLeftMs`), as the host says it - a tree before it reads no such word
      ...(renownReportSoon ? { soon: () => renownReportSoon({ xp: total, pending: tracker?.pending() ?? 0, room: roomHour === hourOf() ? room : null, capped: cappedHour === hourOf(), hourLeftMs: (hourOf() + 1) * 3_600_000 - simMs }) } : {}),
    }) : null;
    const town = 1;   // a town's Notice Board (boardLaw.js boardKeyOk)
    let seq = /** @type {number} */ (R.at().seq);
    const lease = R.lease;
    const checkpointMs = role === 'fighter' ? ONLINE_CHECKPOINT_MS : REALM_IDLE_CHECKPOINT_MS;
    const start = simMs, end = start + minutes * 60_000;
    let nextBoard = start, nextMail = start, nextPost = start, nextBeat = start + PLAY_BEAT_S * 1000, nextSave = start + checkpointMs, nextXp = start + 60_000;
    let saves = 0;
    for (; simMs < end; simMs += 1000) {
      const t = simMs;
      if (t >= nextBoard) {
        // one heartbeat carrying whatever is due (heartbeat.js rides the slower clocks with the board's)
        const body = /** @type {Record<string, any>} */ ({ board: town });
        nextBoard = t + BOARD_CACHE_MS;
        if (t >= nextMail - BOARD_CACHE_MS + 5000) { body.mail = true; nextMail = t + MAIL_POLL_MS; }   // due before the next heartbeat: it rides this one
        if (t >= nextPost - BOARD_CACHE_MS + 5000) { body.post = true; nextPost = t + POST_POLL_MS; }
        if (t >= nextBeat) { body.beat = true; nextBeat += PLAY_BEAT_S * 1000; }   // the play clock knocks on its own clock and rides the next heartbeat
        await route('/v1/heartbeat', () => S.call('/v1/heartbeat', body, who.secret));
      }
      if (t >= nextSave) {
        nextSave = t + checkpointMs;
        const save = JSON.stringify(freshSave({ name: 'Benched', bench: ++saves }));
        const res = await route('/v1/realm/:id/data', () => S.fetch(`https://accounts.invalid/v1/realm/${R.id}/data`, {
          method: 'PUT', headers: { authorization: `Bearer ${who.secret}`, 'x-realm-lease': lease, 'x-realm-seq': String(seq + 1) }, body: save,
        }));
        if (res.status === 200) seq++;
      }
      if (tracker && t >= nextXp) {
        nextXp = t + 60_000; tracker.earn(xp);
        const reach = renownForXp(total + tracker.pending());   // AUDIT SCALE II D-8: a level what is earned now completes
        for (let L = level + 1; L <= reach; L++) if (!earnedAt.has(L)) earnedAt.set(L, t);
      }
      if (tracker) await tracker.tick(t);
    }
    return { role, minutes, xp, renown, routes: byRoute, rows: tally.rows, statements: tally.statements, level, total, reportsAt, rises };
  } finally { Date.now = realNow; }
}

const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const knob = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? Number(args[i + 1]) : d; };
  const o = { minutes: knob('minutes', 60), xp: knob('xp', 40), renown: knob('renown', 20) };
  const quiet = console.warn; console.warn = () => {};
  const out = [];
  for (const role of ['walker', 'fighter']) out.push(await playerHour({ role, ...o }));
  console.warn = quiet;
  if (args.includes('--json')) { console.log(JSON.stringify(out, null, 2)); process.exit(0); }
  console.log(`one player-hour each (${o.minutes} min), the fighter earning ${o.xp} XP a minute at Renown ${o.renown}; law: ${renownReportSoon ? 'SCALE4h' : 'the minute'}\n`);
  for (const r of out) {
    console.log(`${r.role}: ${r.statements} statements, ${sum(r.rows)} rows changed`);
    for (const [k, v] of Object.entries(r.routes).sort((a, b) => b[1].statements - a[1].statements)) console.log(`  ${k.padEnd(22)} ${String(v.requests).padStart(4)} requests ${String(v.statements).padStart(5)} statements ${String(v.rows).padStart(5)} rows`);
    console.log(`  by table: ${Object.entries(r.rows).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  }
}
