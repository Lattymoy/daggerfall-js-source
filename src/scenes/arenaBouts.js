// @ts-check
// ARENA2 (2026-10-02, Mac: "Players can choose to watch AI fights ... and climb esclating tiers of opponents"; "During
// fights, the crowd is present and can cheer/boo you"; "extremely detailed and authentic"): THE BOUT ON THIS SCREEN -
// the bout law (systems/arenaBout.js) driven over real bodies, its crowd (systems/arenaCrowd.js) seen and heard, its
// HUD (ui/arenaHud.js), its music (systems/arenaScore.js), its Herald. Design: bible/11-Multiplayer/Arena.md "2. The
// fights", "4. The crowd".
//
// ONE DRIVER, TWO FLOORS. A bout stands on a STAGE the host hands in (`setStage`): the CITY's floor (the colosseum in
// Daggerfall's cell 4,3 - scenes/world.js, the exterior's own foe pool) for an exhibition on the hour, or the floor's
// INSTANCE (world/arenaFloor.js - the dungeon arm's own pool, scenes/worldModes.js) for a ladder bout or an exhibition
// watched from the stands. A stage is `{ kind, centre(), spawn(mobile, feet, o), remove(foe), heightAt(x, z) }` in its
// host's frame; the driver never asks which host it is in. A stage that goes (the door taken, the city left) takes its
// bout with it, unsaid.
//
// THE FIGHTERS are Daggerfall's own class enemies and monsters (`spawn` - the exterior's spawnFoe `loose`, `transient`,
// `managed`, no loot, no champion, at the tier's level; the dungeon's spawnLooseFoe at its level), each carrying its
// BOUT TAG on its entity (`entity.bout` - `{ id, side, out, hold, hooks }`): the targeting law's bout team
// (characters/enemyTargets.js boutGate) keeps them to each other, and the pools' damage doors hold them at the foe yield
// floor and tell the driver every blow (`hooks.hurt`), the floor (`hooks.floor`) and a blow from outside the bout
// (`hooks.intrude`). The player fights as `you` (setPlayerBout), held at the 1 HP floor by `playerSpare`, and yields by
// sheathing the blade at the yield line.
//
// Not a DFU member. Ledger A (ARENA).

import {
  newBout, boutTick, boutHit, boutMiss, boutFell, boutYield, boutPos, boutHealth, boutAtMarks, takeBoutEvents, boutLive, boutOver, boutFighter,
  fighterShare, boutPurse, sideNames, otherNames, YIELD_SHARE,
} from '../systems/arenaBout.js';
import { newCrowd, crowdHear, crowdTick, crowdBark, crowdCount, crowdFlipFps, crowdHop, verdictThrows, seatPeople, THROWN_FLOWERS, THROWN_REFUSE } from '../systems/arenaCrowd.js';
import { fighterIdentity, boutMarks, boutGateOf } from '../systems/arenaFighters.js';
import { EXHIBITION_PURSE, ladderAfter, arenaLadderRestore, arenaHash, seededRng, ladderTitle } from '../systems/arenaLadder.js';
import { ARENA_TEXT } from '../systems/arenaText.js';
import { arenaScoreFor } from '../systems/arenaScore.js';
import { crowdSeats, pickSeats, RING_R } from '../world/arenaFloor.js';
import { arenaHudModel } from '../ui/arenaHud.js';
import { rollLeague, leagueAfterBout, laurelWorn, laurelBanner, LAUREL_FAVOUR } from '../systems/arenaLeague.js';   // ARENA3: the banners, the laurel, the Records page
import { mirrorOf, mirrorEvents, mirrorHealth, walkAt, walkDone } from '../net/arenaLink.js';
import { ARENA_PUPPET_OWNER, ARENA_CHEER_MS, ARENA_FLOOR_CENTRE } from '../net/arenaLaw.js';   // ARENA4: a bout the relay runs, mirrored here; ARENA4b: the stands' allowance, the relay's frame (the instance's)
import { crowdShout } from '../systems/arenaCrowd.js';   // ARENA4: the stands' own cheers and boos, heard on every screen
import { crowdHalves, crowdHalfOf, crowdWash } from '../systems/arenaCrowd.js';   // ARENA5: the crowd's half in a banner's colours
import { newRecording, recordTick, recordStrike, recordEvent, finishRecording, keepReplay, replayOk, replayFeed, replayId, replayBoutId, playerMobileOf } from '../systems/arenaReplay.js';   // ARENA5: your ladder replay

/** ARENA-FIX 10: A CRIT is the formula's own critical-strike roll (combat/formulas.js calculateAttackDamage's notes,
 *  told through `observeAttackResolution` and matched to the blow the damage door hears - `attackResolved` below).
 *  Where no resolution was told for the blow (a spell, a host whose blow skips the formula), a blow of this share of
 *  the struck's whole health stands in for it - the old approximation, kept only as the fallback. */
export const CRIT_SHARE = 0.15;
/** A resolution told this long before the damage door hears its blow is that blow's, ms. */
export const RESOLUTION_MS = 400;
/** ARENA-FIX 8: a fighter on its walk in is at its mark within this, metres; it walks at this share of its pace. */
export const MARK_ARRIVE_M = 0.6;
export const WALK_PACE = 0.7;
/** ARENA-FIX 13: TEXTURE.185 carries the court's nobles at a scale of +128 (6 m - drawn for Castle Daggerfall's great
 *  hall); in the stands they sit at TEXTURE.183's -128, the same figures' own court scale. */
export const CROWD_SCALE = Object.freeze({ 185: -128 });
/** An AI fighter's id; the player's. */
export const YOU = 'you';
/** How long after the healers the fighters stand before they leave the sand, ms; how long the crowd stays after. */
export const LEAVE_AFTER_MS = 2500;
export const CROWD_STAYS_MS = 25_000;
/** The crowd near: full within this of the floor's centre, nothing past FAR (metres) - the city's bout heard from the
 *  market, not from the far gate. */
export const NEAR_M = 40;
export const FAR_M = 140;
/** A crowd's shout stands under its meter this long, ms. */
export const BARK_SHOWN_MS = 2400;
/** A thrown flat's flight from the stands to the sand, ms. */
export const THROW_MS = 900;
/** ARENA4b: a relay's fighter on the city's sand this far behind the relay's walk is stood where the relay has it. */
export const CITY_SNAP_M = 3;
/** ARENA4: the owner every relay-run fighter's puppet is stood under (net/arenaLaw.js - scenes/dungeonContext.js's own
 *  lane hands a blow on it to the relay's referee, never to a peer). */
export { ARENA_PUPPET_OWNER };
/** ARENA4b: A SPECTATOR'S CHEER OR BOO goes at most one each this long, ms: the relay's own allowance (net/arenaLaw.js
 *  ARENA_CHEER_MS - net/arenaBrain.js cheerOf drops a second inside it, unsaid) and a beat of the wire's slack, so a
 *  press this screen lets through is never one the relay drops after my own crowd has heard it. */
export const CHEER_SLACK_MS = 250;
export const CHEER_GAP_MS = ARENA_CHEER_MS + CHEER_SLACK_MS;

/**
 * @param {{
 *   now?: () => number, rng?: () => number,
 *   playerEntity: any, setPlayerBout?: (b: any) => void,
 *   say?: (line: string) => void, bark?: (line: string) => void, notice?: (lines: string[]) => void,
 *   sound?: { cue: (list: any[], near?: number) => void, bed: (mood: number, near?: number) => void, stop: () => void } | null,
 *   drawHud?: (model: any, o?: any) => void,
 *   renderer?: any, getTexture?: (archive: number) => Promise<any>, uploadRecordFrame?: (a: number, r: number, f: number) => void,
 *   pay?: (gold: number) => void, heal?: () => void, crime?: () => void, ladderChanged?: (ladder: any, out: any) => void,
 *   gameMinutes?: () => number, exhibitionVerdict?: (hour: number, side: number|null) => void,
 * }} deps
 *   ARENA3: `gameMinutes` the game's clock (the season a ladder bout's points go to, the laurel, the Records page's day);
 *   `exhibitionVerdict` an exhibition's verdict seen here (the side that won, null a draw) - the bookmaker's to settle.
 */
export function createArenaBouts(deps) {
  const now = deps.now ?? (() => performance.now());
  const rng = deps.rng ?? Math.random;
  const P = deps.playerEntity;
  let stage = null;
  /** The bout standing: `{ b, crowd, kind, stage, fighters: Map<id, foe>, tags: Map<id, tag>, you, purse, next, ... }` */
  let cur = null;
  /** A bout asked for before its stage stood (the Herald's choice, the instance still building). */
  let pending = null;
  let intrusions = 0;
  /** ARENA4b: THE REALM'S BANNERS while online (scenes/arenaOnline.js hands the source - `{ banner, laurel }`: the banner
   *  my account fights under, the laurel the realm's last season gave), read at each bout's first bell; null offline,
   *  where the save's league is the law. */
  let realmOf = null;
  const realmNow = () => { try { return realmOf?.() ?? null; } catch { return null; } };

  // ── THE STAGE ───────────────────────────────────────────────────────────────────────────────────────────
  /** The host's floor now (or null): a new stage takes no bout of the old one's - the old one is gone, unsaid. */
  function setStage(s) {
    if (s === stage) return;
    if (cur && cur.stage !== s) dismiss();
    stage = s ?? null;
    if (stage && pending && pending.where === stage.kind) { const p = pending; pending = null; begin(p); }
  }
  /** A bout asked for on a stage of `where` ('city' | 'floor'), started when it stands. */
  function ask(p) { pending = p; if (stage && stage.kind === p.where) { pending = null; begin(p); } }
  /** A bout asked for, begun: the relay's exhibition mirrored (ARENA4b), a relay's bout (ARENA4), or one of this screen's. */
  const begin = (p) => (p.relayEx ? startExhibitionRelay(p.relayEx) : p.relay ? startRelay(p.relay) : start(p));

  // ── A BOUT ──────────────────────────────────────────────────────────────────────────────────────────────
  const floorFeet = (xz) => { const c = stage.centre(); return [c[0] + xz[0], c[1], c[2] + xz[1]]; };
  const yawTo = (from, to) => Math.atan2(to[0] - from[0], to[1] - from[1]);

  /**
   * START: an exhibition (`{ kind: 'exhibition', ex }` - systems/arenaLadder.js exhibitionFor) or a ladder bout
   * (`{ kind: 'ladder', next }` - nextLadderBout, the player on side 0). The fighters' names from the bout's seed, their
   * marks on the sand, their tags; the law's bout and the crowd.
   */
  function start(p) {
    if (!stage) return null;
    dismiss();
    const t = now();
    // ARENA-FIX 4: the training pit's PRACTICE bout is a ladder bout's shape (the player on side 0) - no purse, no
    // step on the ladder, no crowd, no music (`quiet`)
    const ladder = p.kind === 'ladder' || p.kind === 'practice';
    const practice = p.kind === 'practice';
    const seed = ladder ? arenaHash(Math.floor(t) & 0x7fffffff, 7) : p.ex.seed;
    const opps = ladder ? p.next.opponents : p.ex.opponents;
    const free = ladder && !!p.next.free;
    const id = practice ? `practice:${seed}` : ladder ? `ladder:${p.next.tier}:${p.next.bout}:${seed}` : `ex:${p.ex.hour}`;
    // the sides: an exhibition's two, a ladder bout's player against the rest (a Grand Melee every fighter its own)
    const specs = opps.map((o, i) => ({ ...o, i, side: free ? i + 1 : ladder ? 1 : i }));
    const sides = free ? specs.length + 1 : 2;
    const perSide = Array(sides).fill(0);
    if (ladder) perSide[0] = 1;
    for (const s of specs) perSide[s.side]++;
    // the marks on the floor's long axis - or, on a stage with its own way (the undercroft's pit, a passage), along it
    // and `markScale` as far apart
    const k = stage.markScale ?? 1, ax = stage.axis;
    const marks = boutMarks(sides, perSide).map((side) => side.map(([x, z]) => (ax ? [(x * ax[0] - z * ax[1]) * k, (x * ax[1] + z * ax[0]) * k] : [x * k, z * k])));
    const used = Array(sides).fill(0);
    if (ladder) used[0] = 1;
    const fighters = [];
    const tags = new Map();
    const hooks = (fid) => ({
      hurt: (foe, dmg, o) => hurtFoe(fid, foe, dmg, o),
      floor: (foe) => floorFoe(fid, foe),
      intrude: (foe) => intrude(fid, foe),
    });
    for (const s of specs) {
      const fid = `f${s.i}`;
      const who = fighterIdentity(seed, s.i, s.mobile);
      const mark = marks[s.side][used[s.side]++];
      tags.set(fid, { id, side: s.side, out: false, hold: true, hooks: hooks(fid) });
      fighters.push({ id: fid, name: who.name, side: s.side, maxHealth: 1, temper: who.temper, ai: true, home: who.home, epithet: who.epithet, spec: s, who, mark });
    }
    // ARENA3: the Herald cries me by the title the ladder gave me ("Aldric, Grand Champion!") - my epithet on the sand
    if (ladder) fighters.unshift({ id: YOU, name: P?.name || 'You', side: 0, maxHealth: Math.max(1, P?.maxHealth | 0), health: Math.max(1, P?.health | 0), temper: 0, ai: false, home: '', epithet: ladderTitle(P?.arenaLadder) ?? '', mark: marks[0][0] });
    cur = {
      kind: p.kind, id, seed, stage, ladder, next: ladder ? p.next : null, ex: ladder ? null : p.ex, fighters: new Map(), tags, marks,
      roster: fighters, b: null, crowd: null, you: ladder ? YOU : null, playerTag: ladder ? { id, side: 0, out: false, hold: true } : null,
      practice, quiet: practice, ring: stage.radius ?? RING_R, lastBlow: new Map(), walking: new Set(),
      lastHealth: P?.health ?? 0, lastSheathed: null, verdictAt: NaN, doneAt: NaN, paid: false, said: false, crowdSeats: null,
      crowdBatches: [], throws: [], spawning: 0, title: false, startedAt: t, bark: '', barkAt: -Infinity, ringed: null,
      teams: boutTeams(ladder, practice, fighters),
    };
    if (ladder) deps.setPlayerBout?.(cur.playerTag);
    // ARENA-FIX 8: THE ENTRANCE - each fighter stands at the mouth of its side's passage under the tiers (the floor's
    // two gates, systems/arenaFighters.js boutGateOf; a pit has no gates - its fighter stands on the mark) facing in,
    // and walks to its mark when the Herald cries its name (`hear`, 'crier'); the law starts once every body stands
    const C = cur;
    for (const f of fighters) {
      if (!f.ai) continue;
      const from = stage.gates === false ? f.mark : boutGateOf(f.mark);
      const feet = floorFeet(from);
      C.spawning++;
      Promise.resolve(stage.spawn(f.spec.mobile, feet, { level: f.spec.level, gender: f.who.gender, yaw: yawTo(from, f.mark[0] === from[0] && f.mark[1] === from[1] ? [0, 0] : f.mark), bout: tags.get(f.id) }))
        .then((foe) => {
          C.spawning--;
          if (cur !== C || !foe) { if (foe) stage?.remove?.(foe); if (cur === C && !foe) dismiss(); return; }
          C.fighters.set(f.id, foe);
          if (foe.entity) { foe.entity.bout = tags.get(f.id); foe.entity.items = []; }
          f.maxHealth = Math.max(1, foe.entity?.maxHealth ?? foe.entity?.health ?? 1);
          f.health = Math.max(1, foe.entity?.health ?? f.maxHealth);
          if (foe.ai) { foe.ai.isHostile = !!C.ladder; foe.ai.target = null; foe.ai.yaw = yawTo(f.mark, [0, 0]); }
          if (C.spawning === 0) beginLaw(C);
        })
        .catch(() => { C.spawning--; if (cur === C) dismiss(); });
    }
    return cur;
  }

  /** Every body stands: the law's bout, the crowd's, the seats. */
  function beginLaw(C) {
    const t = now();
    const c = stage.centre();
    C.b = newBout({
      id: C.id, kind: C.practice ? 'practice' : C.ladder ? (C.next.grand ? 'grand' : C.next.champion ? 'champion' : C.next.free ? 'melee' : 'ladder') : 'exhibition',
      fighters: C.roster.map((f) => ({ id: f.id, name: f.name, side: f.side, maxHealth: f.maxHealth, health: f.health, temper: f.temper, ai: f.ai, home: f.home, epithet: f.epithet })),
      ring: { centre: [c[0], c[2]], radius: C.ring }, now: t, tier: C.ladder ? C.next.tier : C.ex.tier, label: C.ladder ? C.next.label : '',
    });
    C.crowd = newCrowd({ fighters: C.roster.map((f) => ({ id: f.id, home: f.home, ai: f.ai })), beasts: C.ladder ? !!C.next.beasts : !!C.ex.beasts });
    laurelFavour(C);
    if (!C.quiet) buildCrowd(C);
    beginRecording(C, t);   // ARENA5: a ladder bout recorded for its replay
  }
  // ── ARENA5: YOUR LADDER REPLAY (systems/arenaReplay.js) ─────────────────────────────────────────────────────
  /** A LADDER BOUT RECORDED from its first bell (never the pit's, never a relay's): its fighters in the law's order - me
   *  as the class enemy of my own career - the bout it is, the banners its halves wear, the game minute it is fought at
   *  (the Records page's row the replay is offered on). */
  function beginRecording(C, t) {
    if (!C.ladder || C.practice || C.relay || !C.b) return;
    const sides = crowdHalves(C.b.fighters, C.teams);
    C.rec = newRecording({
      t0: t, next: C.next, sides, at: deps.gameMinutes?.() ?? 0,
      fighters: C.b.fighters.map((f) => {
        const r = C.roster.find((x) => x.id === f.id);
        return { id: f.id, name: f.name, side: f.side, mobile: f.ai ? r?.spec?.mobile : playerMobileOf(P), gender: f.ai ? r?.who?.gender : P?.gender, home: f.home, epithet: f.epithet, health: f.health, maxHealth: f.maxHealth };
      }),
    });
  }
  /** THE TICKS DUE of the recording: each fighter's feet and facing from the floor's centre (mine my feet and my view's
   *  yaw, a fighter's its body's), and its health. */
  function recordFrame(C, t, o) {
    if (!C.rec || !stage) return;
    const c = stage.centre();
    const poses = C.rec.ids.map((id) => {
      if (id === YOU) return o.playerFeet ? [o.playerFeet[0] - c[0], o.playerFeet[2] - c[2], o.playerYaw ?? 0] : null;
      const foe = C.fighters.get(id);
      return foe?.ai?.feet ? [foe.ai.feet[0] - c[0], foe.ai.feet[2] - c[2], foe.ai.yaw ?? 0] : null;
    });
    recordTick(C.rec, t, poses, C.rec.ids.map((id) => { const f = boutFighter(C.b, id); return f ? [f.health, f.maxHealth] : null; }));
  }
  /** THE BOUT DONE (the healers have been): its record kept on the save's arena record, the newest first, the oldest past
   *  REPLAY_KEEP let go - a bout left before its verdict keeps none. */
  function keepRecording(C) {
    const rec = C.rec && C.b?.result ? finishRecording(C.rec, C.b.result) : null;
    C.rec = null;
    // the Records page's row for it is the one its verdict wrote (the game's clock ran on through the bout): its minute
    const row = P?.arenaLeague?.bouts?.[0];
    if (rec && row && Number.isFinite(row.at) && row.tier === rec.next?.tier) rec.at = row.at;
    if (rec && P) P.arenaReplays = keepReplay(P.arenaReplays, rec);
  }
  /**
   * WATCH A REPLAY (one of the save's - `rec` a record of systems/arenaReplay.js): asked for the floor's instance as a
   * relay's bout watched from the stands - the mirror's own puppets, HUD, crowd, Herald and music, fed the recorded words
   * (`replayFeed`, each frame, below) instead of a relay's. Its banners its record's (`sides`; each fighter its side's on
   * the versus bar); the stands' presses are heard by this screen's crowd alone; nothing of it pays or counts. Answers
   * whether it was asked.
   */
  function askReplay(rec) {
    if (!replayOk(rec)) return false;
    const banners = {};
    rec.f.forEach((f, i) => { const b = rec.sides[f.s]; if (b) banners[replayId(i)] = b; });
    ask({
      where: 'floor',
      relay: {
        o: replayBoutId(rec), kind: 'pve', me: '', next: rec.next ? { ...rec.next, purse: 0 } : null, sides: rec.sides, banners,
        names: (i) => (rec.f[i] ? { name: rec.f[i].n, home: rec.f[i].h, epithet: rec.f[i].e, gender: rec.f[i].g } : null),
        send: { cheer: () => true },   // the stands' presses: my crowd hears me, nobody else is there
        replay: { rec, feed: null },
      },
    });
    return true;
  }
  /** A REPLAY'S FRAME: its words due fed to the mirror as a relay's would be (relayWord), the recorded call said as the
   *  replay's own (the Herald names the bout from the records), and each puppet standing still turned as it was. */
  function replayFrame(C, t) {
    const R = C.relay?.replay;
    if (!R || !stage) return;
    if (!R.feed) {
      R.feed = replayFeed(R.rec, { t0: t, centre: stage.centre(), o: C.relay.o });
      if (!R.feed) { dismiss(); return; }
      for (const w of R.feed.first) relayWord(w);
      relayWord(R.feed.st);
    }
    for (const w of R.feed.due(t)) {
      if (w.k !== 'call') { relayWord(w); continue; }
      if (C.crowd) deps.sound?.cue(crowdHear(C.crowd, { k: 'call' }, { now: t }), 1);
      const nx = C.next;
      deps.say?.(nx ? ARENA_TEXT.replay.call(nx.tierName, nx.grand ? ARENA_TEXT.grandLabel : nx.champion ? ARENA_TEXT.champLabel : nx.label) : ARENA_TEXT.replay.callBare);
    }
    for (const [id, foe] of C.fighters) {
      const i = Number(String(id).slice(1));
      if (foe._pup && !foe._pup.moving && Number.isInteger(i)) foe._pup.yaw = R.feed.yawAt(i, t);
    }
  }

  // ── THE BANNERS (ARENA3) ────────────────────────────────────────────────────────────────────────────────
  /** Each fighter's banner on the versus bar: in a ladder bout mine (the banner I wear - none, no mark) and the house's
   *  fighters none; an exhibition is the Red Banner's fighter against the Blue's (side 0 and side 1). Never the pit's. */
  function boutTeams(ladder, practice, fighters) {
    /** @type {Record<string, string>} */
    const out = {};
    if (practice) return out;
    if (ladder) { const R = realmNow(), team = R ? R.banner : leagueNow()?.team; if (team) out[YOU] = team; return out; }   // ARENA4b: online the account's
    for (const f of fighters) out[f.id] = f.side === 0 ? 'red' : 'blue';
    return out;
  }
  const leagueNow = () => { const gm = deps.gameMinutes?.(); return P && Number.isFinite(gm) ? rollLeague(P.arenaLeague, gm) : null; };
  /** THE LAUREL: the crowd favours the fighters of the banner that won last season from the first bell - me, when I
   *  wear it; an exhibition's fighter in its colours. ARENA4b: online the laurel is the realm's and my banner the
   *  account's (`realmNow`), never the save's - an exhibition on this screen's floor too. */
  function laurelFavour(C) {
    if (C.practice) return;
    const R = realmNow();
    if (R) { laurelOf(C, R.laurel, C.ladder ? { [YOU]: R.banner } : C.teams); return; }
    const gm = deps.gameMinutes?.();
    if (!P || !Number.isFinite(gm)) return;
    if (C.ladder) { if (laurelWorn(P.arenaLeague, gm)) C.crowd.favour[YOU] = Math.min(1, (C.crowd.favour[YOU] ?? 0) + LAUREL_FAVOUR); return; }
    laurelOf(C, laurelBanner(P.arenaLeague, gm), C.teams);
  }
  /**
   * ARENA5: THE BANNERS THE FLOOR HANGS (Arena.md 3: "your banners on your side of the floor") for the bout asked for the
   * floor's instance - the host asks while it lays the instance (scenes/worldModes.js enterArenaFloor, world/arenaFloor.js
   * arenaFloorBlock), after the bout was asked and before its stage stands. `{ west, east }`: side 0's banner and side
   * 1's, each 'red', 'blue' or null - a ladder bout mine on the west (the save's banner offline, the realm's online -
   * boutTeams' own law), an exhibition the Red against the Blue, a relay's bout each player's (mine the realm's, my
   * rival's or a watched pair's as the hall billed them - relayBanners' law), or the sides a bout hands in (`sides`, a
   * replay's recorded pair). Nothing for a bout of no banner, the pit's, or none asked.
   */
  function floorBanners() {
    const p = pending?.where === 'floor' ? pending : null;
    const none = { west: null, east: null };
    if (!p) return none;
    const ok = (b) => (b === 'red' || b === 'blue' ? b : null);
    if (p.relay) {
      const r = p.relay;
      if (Array.isArray(r.sides)) return { west: ok(r.sides[0]), east: ok(r.sides[1]) };
      const out = { west: null, east: null };
      const put = (id, b) => { const m = /^p([01])$/.exec(String(id)); if (m && ok(b)) out[m[1] === '0' ? 'west' : 'east'] = ok(b); };
      for (const [id, b] of Object.entries(r.banners ?? {})) put(id, b);
      if (r.me) put(r.me, realmNow()?.banner);
      return out;
    }
    if (p.kind === 'exhibition') return { west: 'red', east: 'blue' };
    if (p.kind === 'ladder') { const R = realmNow(); return { west: ok(R ? R.banner : leagueNow()?.team), east: null }; }
    return none;
  }
  /** The laurel's favour (+LAUREL_FAVOUR) to each fighter of `teams` in the laurel's banner `won`. */
  function laurelOf(C, won, teams) {
    if (won !== 'red' && won !== 'blue') return;
    for (const [id, team] of Object.entries(teams)) if (team === won && C.b?.fighters.some((f) => f.id === id)) C.crowd.favour[id] = Math.min(1, (C.crowd.favour[id] ?? 0) + LAUREL_FAVOUR);
  }

  // ── THE BODIES' DOORS (the pools' bout hooks) ───────────────────────────────────────────────────────────
  function hurtFoe(fid, foe, dmg, { fromPlayer = false, striker = null } = {}) {
    const C = cur;
    if (!C?.b) return;
    const t = now();
    if (!boutLive(C.b)) {
      // a blow before the word or after the verdict: the body is made whole again (the healers' law), nothing counts
      if (foe?.entity) foe.entity.health = Math.min(foe.entity.maxHealth ?? foe.entity.health, foe.entity.health + dmg);
      return;
    }
    const from = fromPlayer ? (C.ladder ? YOU : null) : idOf(C, striker);
    if (!from) { boutHealth(C.b, fid, foe?.entity?.health ?? 0); return; }
    const f = boutFighter(C.b, fid);
    boutHit(C.b, { from, to: fid, dmg, health: foe?.entity?.health, crit: critOf(C, fid, dmg, f?.maxHealth ?? 1, t), now: t });
  }
  /** ARENA-FIX 10: whether a blow on `to` was a critical strike - the formula's own roll when the resolution was told
   *  for it (`attackResolved`), else the CRIT_SHARE stand-in. */
  function critOf(C, to, dmg, maxHealth, t) {
    const r = C.lastBlow.get(to);
    if (r && t - r.at <= RESOLUTION_MS) { C.lastBlow.delete(to); return r.critical; }
    return dmg >= maxHealth * CRIT_SHARE;
  }
  /** The bout's id of an entity (a fighter's body, or the player in my own bout), or null. */
  const idOfEntity = (C, ent) => {
    if (!ent) return null;
    if (C.ladder && ent === P) return YOU;
    for (const [id, foe] of C.fighters) if (foe.entity === ent) return id;
    return null;
  };
  /**
   * ARENA-FIX 9 + 10: AN ATTACK RESOLVED (combat/formulas.js observeAttackResolution - every calculateAttackDamage,
   * whoever swung: the player's blows and arrows, a fighter's on the player, a fighter's on a fighter). Inside a live
   * bout, between two of its fighters on different sides: no damage is a MISS for the striker (the judges' third count);
   * a blow that lands leaves its critical-strike flag for the damage door to read (critOf).
   */
  function attackResolved(r) {
    const C = cur;
    if (C?.relay) return;   // ARENA4: the relay's referee counts the misses of a bout it runs
    if (!C?.b || !boutLive(C.b) || !r) return;
    const from = idOfEntity(C, r.attacker), to = idOfEntity(C, r.target);
    if (!from || !to || from === to) return;
    const a = boutFighter(C.b, from), b = boutFighter(C.b, to);
    if (!a || !b || a.side === b.side) return;
    const t = now();
    if (from !== YOU) recordStrike(C.rec, t, from);   // ARENA5: a fighter's blow, its puppet's swing in the replay (mine is my swing's - playerSwing)
    if (!(r.damage > 0)) boutMiss(C.b, { from, now: t });
    else C.lastBlow.set(to, { critical: !!r.critical, at: t });
  }
  /** ARENA-FIX 9: the player's swing reached nobody (combat/playerWeapon.js observePlayerSwing, `struck` 0) - in my own
   *  live bout, a miss. */
  function playerSwing(struck) {
    const C = cur;
    // ARENA4: on a relay's sand a swing that reached nobody is told the referee as a blow of nothing - the judges' third count
    if (C?.relay) {
      if (!C.you || !C.b || !boutLive(C.b) || struck > 0) return;
      const me = boutFighter(C.b, C.you);
      const foe = C.b.fighters.find((f) => !f.out && me && f.side !== me.side);
      if (me && !me.out && foe) C.relay.send?.hit?.({ k: 'hit', i: foe.id, d: 0, r: 0 });
      return;
    }
    if (C?.ladder && C.b && boutLive(C.b)) recordStrike(C.rec, now(), YOU);   // ARENA5: every swing of mine, my puppet's in the replay
    if (!C?.ladder || !C.b || !boutLive(C.b) || struck > 0) return;
    const you = boutFighter(C.b, YOU);
    if (you && !you.out) boutMiss(C.b, { from: YOU, now: now() });
  }
  function floorFoe(fid, foe) {
    const C = cur;
    if (!C?.b) return;
    if (!boutLive(C.b)) { if (foe?.entity) foe.entity.health = Math.max(foe.entity.health, 1); return; }
    boutFell(C.b, fid, now());
    standDown(foe);
  }
  /** A blow from outside the bout: before the word (the player's own opponent), a word from the Herald; an exhibition
   *  fighter struck from the stands, a warning and then the watch. */
  function intrude(fid, foe) {
    const C = cur;
    if (!C) return;
    if (C.ladder && C.b && !boutLive(C.b) && !boutOver(C.b)) { deps.say?.(ARENA_TEXT.herald.waitWord); return; }
    if (C.ladder) return;
    intrusions++;
    if (intrusions === 1) deps.say?.(ARENA_TEXT.herald.intrude);
    else { deps.say?.(ARENA_TEXT.herald.intrudeCrime); deps.crime?.(); }
  }
  const idOf = (C, foe) => { if (!foe) return null; for (const [id, f] of C.fighters) if (f === foe) return id; return null; };
  /** A fighter out of the bout stands down: no target, nobody's target (its tag is out), no hostility. */
  function standDown(foe) {
    if (!foe) return;
    if (foe.entity?.bout) foe.entity.bout.out = true;
    if (foe.ai) { foe.ai.target = null; foe.ai.secondaryTarget = null; foe.ai.isHostile = false; }
  }

  // ── THE PLAYER'S DOORS ──────────────────────────────────────────────────────────────────────────────────
  /** The `spare` the host's damage doors pass while I fight a live bout: the blow that would kill leaves me at 1 and
   *  I am down (playerEntity.hurtPlayer's own law, the duel's). Null outside one. */
  function playerSpare() {
    const C = cur;
    // ARENA4: on a relay's sand my health is the relay's - a blow from anything here holds me at the breath of life, and
    // the fall is the relay's to say
    if (C?.relay) return C.you && C.b && boutLive(C.b) ? { spare: () => {} } : null;
    if (!C?.ladder || !C.b || C.b.phase !== 'fight' || C.playerTag?.out) return null;
    return { spare: () => { if (cur === C && C.b && boutLive(C.b)) { boutFell(C.b, YOU, now()); } } };
  }
  /** My own bout stands (its call to its healers): the duel's law - no door, no rest, no travel. */
  const holds = () => !!cur?.ladder && !!cur.b && cur.b.phase !== 'done';

  // ── THE FRAME ───────────────────────────────────────────────────────────────────────────────────────────
  /**
   * One frame: the bodies read into the law (their health, their feet, my blows taken, my sheathing), the law's clock,
   * its events heard (the crowd, the Herald, the sound), the HUD drawn, the crowd's people moved. `o.playerFeet` my feet
   * in the stage's frame, `o.sheathed` my weapon put away, `o.stamina` my fatigue's share, `o.hidden` the HUD hidden.
   * ARENA5: `o.playerYaw` my view's yaw (my facing in the replay's recording).
   */
  function frame(dt, o = {}) {
    const C = cur;
    const t = now();
    if (C?.relay?.replay) replayFrame(C, t);   // ARENA5: a replay's recorded words, fed to the mirror below
    if (C?.relay) { relayFrame(C, dt, o, t); return; }   // ARENA4: a bout the relay runs, mirrored
    if (!C || !C.b) { deps.drawHud?.(null, { hidden: true }); return; }
    const c = stage?.centre?.() ?? null;
    const near = c && o.playerFeet ? nearOf(Math.hypot(o.playerFeet[0] - c[0], o.playerFeet[2] - c[2])) : (C.stage?.kind === 'floor' ? 1 : 0);
    // the bodies into the law
    for (const [fid, foe] of C.fighters) {
      const tag = C.tags.get(fid);
      if (foe.dead) { if (boutLive(C.b)) boutFell(C.b, fid, t); continue; }
      if (foe.ai?.feet) boutPos(C.b, fid, [foe.ai.feet[0], foe.ai.feet[2]]);
      if (tag) tag.hold = !boutLive(C.b);
      // ARENA-FIX 8: a fighter on its walk in, at its mark: it turns to the middle, and the law hears it there
      if (C.walking.has(fid) && arrived(C, fid, foe)) {
        C.walking.delete(fid);
        if (foe.ai) { foe.ai.walkGoal = null; foe.ai.yaw = yawTo(markOf(C, fid), [0, 0]); }
        if (C.b.phase === 'walk') boutAtMarks(C.b, fid, t);
      }
    }
    if (C.playerTag) C.playerTag.hold = !boutLive(C.b);
    if (C.ladder && P) {
      // my health: a fall in it is a blow at me from the opponent nearest me who has me as their target
      const h = P.health ?? 0;
      if (boutLive(C.b) && h < C.lastHealth) {
        const from = attackerOfMe(C, o.playerFeet);
        if (from) boutHit(C.b, { from, to: YOU, dmg: C.lastHealth - h, health: h, crit: critOf(C, YOU, C.lastHealth - h, P.maxHealth || 1, t), now: t });
        else boutHealth(C.b, YOU, h);
      } else if (h !== C.lastHealth) boutHealth(C.b, YOU, h);
      C.lastHealth = h;
      if (o.playerFeet) boutPos(C.b, YOU, [o.playerFeet[0], o.playerFeet[2]]);
      // THE YIELD: the blade sheathed at the line (drawn again first: a sheathe from before the line is no yield)
      const you = boutFighter(C.b, YOU);
      if (o.sheathed != null) {
        if (C.lastSheathed === false && o.sheathed === true && boutLive(C.b) && you && !you.out) {
          const no = boutYield(C.b, YOU, t);
          if (no === 'early' && fighterShare(you) > YIELD_SHARE) deps.say?.(ARENA_TEXT.refuse.yieldEarly);
        }
        C.lastSheathed = !!o.sheathed;
      }
    }
    boutTick(C.b, t, rng);
    for (const e of takeBoutEvents(C.b)) { recordEvent(C.rec, e); hear(C, e, t, near); }   // ARENA5: each kept for the replay
    recordFrame(C, t, o);   // ARENA5: the fighters' feet, facing and health, ten a second
    // the word given (or the verdict said) this frame: the bout team's hold follows it now, not a frame late
    for (const tag of C.tags.values()) tag.hold = !boutLive(C.b);
    if (C.playerTag) C.playerTag.hold = !boutLive(C.b);
    crowdTick(C.crowd, dt);
    if (!C.quiet) deps.sound?.bed(C.crowd.mood, near);
    // the fighters out of the bout stand down; at the end everyone does
    for (const f of C.b.fighters) {
      const foe = C.fighters.get(f.id);
      if (foe && (f.out || boutOver(C.b))) { standDown(foe); if (C.tags.get(f.id)) C.tags.get(f.id).out = !!f.out || boutOver(C.b); }
    }
    if (C.playerTag && (boutOver(C.b) || boutFighter(C.b, YOU)?.out)) C.playerTag.out = true;
    // the healers, then off the sand
    if (C.b.phase === 'done' && !Number.isFinite(C.doneAt)) { C.doneAt = t; keepRecording(C); }   // ARENA5: the replay kept
    if (Number.isFinite(C.doneAt) && t - C.doneAt >= LEAVE_AFTER_MS && C.fighters.size) {
      for (const foe of C.fighters.values()) stage?.remove?.(foe);
      C.fighters.clear();
      deps.setPlayerBout?.(null);
    }
    if (Number.isFinite(C.doneAt) && t - C.doneAt >= CROWD_STAYS_MS && C.stage?.kind === 'city') { dismiss(); return; }
    const bark = t - C.barkAt < BARK_SHOWN_MS ? C.bark : '';
    deps.drawHud?.(near > 0 ? arenaHudModel(C.b, C.crowd, t, { you: C.you, stamina: o.stamina ?? null, bark, quiet: C.quiet, teams: C.teams }) : null, { hidden: !!o.hidden, touch: !!o.touch });
    crowdFrame(C, t);
  }
  const nearOf = (d) => (d <= NEAR_M ? 1 : d >= FAR_M ? 0 : 1 - (d - NEAR_M) / (FAR_M - NEAR_M));
  /** ARENA-FIX 8: a fighter's mark in the stage's frame ([x, z] from the centre), its feet there, and whether its body
   *  has reached it (its motor's walk done, or within MARK_ARRIVE_M). */
  const markOf = (C, fid) => C.roster.find((f) => f.id === fid)?.mark ?? [0, 0];
  function arrived(C, fid, foe) {
    if (!foe.ai?.feet) return true;
    if (foe.ai.walkArrived) return true;
    const m = floorFeet(markOf(C, fid));
    return Math.hypot(foe.ai.feet[0] - m[0], foe.ai.feet[2] - m[2]) <= MARK_ARRIVE_M;
  }
  /** ARENA-FIX 8: THE WALK IN - a fighter cried by the Herald walks from its gate to its mark (characters/enemyMotor.js
   *  walkTo, its own pursuit walk through the collider at WALK_PACE). One already there is at its mark at once. */
  function walkIn(C, fid) {
    const foe = C.fighters.get(fid);
    if (!foe?.ai || C.walking.has(fid)) return;
    C.walking.add(fid);
    if (arrived(C, fid, foe)) return;
    if (typeof foe.ai.walkTo === 'function') foe.ai.walkTo(floorFeet(markOf(C, fid)), { pace: WALK_PACE });
  }
  /** The opponent striking me: of those whose target is a player, the nearest. */
  function attackerOfMe(C, feet) {
    let best = null, bd = Infinity;
    for (const [fid, foe] of C.fighters) {
      const f = boutFighter(C.b, fid);
      if (!f || f.out || f.side === 0 || !foe.ai?.feet) continue;
      const tgt = foe.ai.target;
      const d = feet ? Math.hypot(foe.ai.feet[0] - feet[0], foe.ai.feet[2] - feet[2]) : 0;
      const k = (tgt && tgt.isPlayer ? 0 : 50) + d;
      if (k < bd) { bd = k; best = fid; }
    }
    return best;
  }

  /** AN EVENT HEARD: the crowd moved and heard, a bark, the Herald's words, the verdict's purse and the healers. */
  function hear(C, e, t, near) {
    const title = C.ladder && !!C.next?.champion && C.b.result?.side === (C.relay ? boutFighter(C.b, C.you)?.side : 0);   // ARENA4: a relay's bout has no ladder step for a player pair, and my side is the one I fight on
    const cues = crowdHear(C.crowd, e, { share: (id) => { const f = boutFighter(C.b, id); return f ? fighterShare(f) : 1; }, title, now: t });
    if (!C.quiet) {   // the training pit: no crowd to hear it, no music
      deps.sound?.cue(cues, near);
      if (near > 0.3) { const line = crowdBark(C.crowd, e, t, rng); if (line) { C.bark = line; C.barkAt = t; deps.bark?.(line); } }
    }
    const say = (line) => { if (near > 0.3) deps.say?.(line); };
    switch (e.k) {
      case 'call':
        if (C.relay && !C.next && !C.ex) { say(ARENA_TEXT.call.players); break; }   // ARENA4: a bout between players (ARENA4b: the relay's exhibition is called as one)
        say(C.practice ? ARENA_TEXT.undercroft.practiceCall : C.ladder ? (C.next.grand ? ARENA_TEXT.call.grand : C.next.champion ? ARENA_TEXT.call.champion(C.next.tierName) : C.next.free ? ARENA_TEXT.call.melee : ARENA_TEXT.call.ladder(C.next.tierName, C.next.label)) : ARENA_TEXT.call.exhibition);
        break;
      case 'crier': {
        const f = boutFighter(C.b, e.a);
        if (f) say(ARENA_TEXT.call.fighter(`${f.name}, ${f.epithet || ''}`.replace(/, $/, ''), f.ai ? f.home : ''));   // ARENA3: mine by my title
        if (f?.ai && !C.relay) walkIn(C, f.id);   // ARENA-FIX 8: named, they walk in from their gate (ARENA4: a relay's fighter walks by the relay's word)
        break;
      }
      case 'walk':
        // to the marks: the player stands on theirs; a fighter already there (or with no body to walk) is at it
        say(ARENA_TEXT.call.marks);
        if (C.relay) break;   // ARENA4: the relay stands its fighters on their marks
        for (const f of C.b.fighters) {
          if (!f.ai) { boutAtMarks(C.b, f.id, t); continue; }
          walkIn(C, f.id);
          const foe = C.fighters.get(f.id);
          if (!foe || arrived(C, f.id, foe)) { C.walking.delete(f.id); boutAtMarks(C.b, f.id, t); }
        }
        break;
      case 'count':   // the walk's limit came first: whoever is still walking stops where they are
        for (const fid of C.walking) { const foe = C.fighters.get(fid); if (foe?.ai) { foe.ai.walkGoal = null; foe.ai.yaw = yawTo(markOf(C, fid), [0, 0]); } }
        C.walking.clear();
        say(ARENA_TEXT.count[3 - (e.n ?? 3)]);
        break;
      case 'fight': say(ARENA_TEXT.count[3]); break;
      case 'verdict': if (C.relay) relayVerdict(C, t); else verdict(C, t); break;
      case 'heal': heal(C); break;
      default: break;
    }
  }

  /** THE VERDICT: the Herald's words, the purse, the ladder's step. */
  function verdict(C, t) {
    const r = C.b.result;
    C.verdictAt = t;
    if (!r) return;
    const V = ARENA_TEXT.verdict;
    const w = r.side === null ? '' : sideNames(C.b, r.side), l = r.side === null ? '' : otherNames(C.b, r.side);
    const line = r.side === null ? V.draw : r.how === 'judges' ? V.judges(w) : r.how === 'yield' ? V.yield(w, l) : r.how === 'ringout' ? V.ringout(w, l) : V.fall(w, l);
    deps.say?.(line);
    // the crowd's throw: flowers for a winner it liked, refuse for one it did not
    const throws = verdictThrows(C.crowd, r.winners, r.losers);
    throwAt(C, r.winners, throws.flowers, THROWN_FLOWERS);
    throwAt(C, [...r.losers, ...r.winners], throws.refuse, THROWN_REFUSE);
    if (C.practice) {
      // ARENA-FIX 4: the pit's bout - no purse, no step on the ladder, the Pit Master's word
      const U = ARENA_TEXT.undercroft;
      deps.notice?.([line, r.side === null ? U.practiceDraw : r.side === 0 ? U.practiceWon : U.practiceLost]);
    } else if (C.ladder) {
      const won = r.side === 0;
      const purse = won ? boutPurse(C.next.purse, C.crowd.favour[YOU] ?? 0) : 0;
      if (won && purse > 0 && !C.paid) { C.paid = true; deps.pay?.(purse); }
      const fav = C.crowd.favour[YOU] ?? 0;
      const pline = !won ? ARENA_TEXT.purse.lost : fav >= 0.25 ? ARENA_TEXT.purse.favoured(purse) : fav <= -0.25 ? ARENA_TEXT.purse.hated(purse) : ARENA_TEXT.purse.won(purse);
      const before = arenaLadderRestore(P?.arenaLadder);
      const out = ladderAfter(before, { won, how: r.side === null ? 'draw' : (boutFighter(C.b, YOU)?.out ?? r.how), purse });
      if (P) P.arenaLadder = out.ladder;
      const lines = [line, pline];
      if (out.grand) lines.push(V.grand(P?.name || 'You'));
      else if (out.title) lines.push(V.tier(P?.name || 'You', ARENA_TEXT.tiers[C.next.tier]));
      if (out.tierUp) lines.push(ARENA_TEXT.ladder.tierUp(ARENA_TEXT.tiers[out.ladder.tier]));
      else if (won && !C.next.champion) lines.push(out.ladder.won >= 3 ? ARENA_TEXT.ladder.champOpen(ARENA_TEXT.tiers[out.ladder.tier]) : ARENA_TEXT.ladder.boutWon(out.ladder.won));
      // ARENA3: the bout kept for the Records page, its points given to the banner worn
      const gm = deps.gameMinutes?.();
      if (P && Number.isFinite(gm)) {
        const opp = C.roster.filter((f) => f.ai).map((f) => f.name).join(', ');
        const league = leagueAfterBout(P.arenaLeague, { gameMinutes: gm, tier: C.next.tier, label: C.next.label, opp, won, how: r.side === null ? 'draw' : won ? r.how : (boutFighter(C.b, YOU)?.out ?? r.how), purse, champion: C.next.champion, grand: C.next.grand });
        P.arenaLeague = league;
        const pts = league.bouts[0]?.points ?? 0;
        if (pts > 0 && league.team) lines.push(ARENA_TEXT.ladder.points(pts, ARENA_TEXT.teams.the[league.team]));
      }
      deps.ladderChanged?.(out.ladder, out);
      deps.notice?.(lines);
    } else {
      if (r.side !== null) { C.bark = ARENA_TEXT.purse.won(EXHIBITION_PURSE); C.barkAt = t; }
      deps.exhibitionVerdict?.(C.ex.hour, r.side);   // ARENA3: the bookmaker settles a wager on it by what was seen
    }
  }
  /** THE HEALERS: everyone whole (the duel's own heal, the host's), the fighters' bodies too. */
  function heal(C) {
    if (C.relay) { if (C.you) { deps.heal?.(); deps.say?.(ARENA_TEXT.healed); } return; }   // ARENA4: the relay's fighters heal on its word
    if (C.ladder) { deps.heal?.(); deps.say?.(ARENA_TEXT.healed); C.lastHealth = P?.health ?? C.lastHealth; }
    for (const foe of C.fighters.values()) if (foe.entity) foe.entity.health = foe.entity.maxHealth ?? foe.entity.health;
  }

  // ── THE CROWD, SEEN ─────────────────────────────────────────────────────────────────────────────────────
  /** The tiers' people: the seats sought on the stage's ground, as many as the bout draws, batched by picture (two
   *  batches a picture, so the tiers' hop is not one plank). In the floor's frame; drawn about its centre. */
  async function buildCrowd(C) {
    const r = deps.renderer;
    if (!r?.createBillboardBatch || !deps.getTexture || !stage?.heightAt) return;
    const c = stage.centre();
    const seats = crowdSeats((x, z) => { const h = stage.heightAt(c[0] + x, c[2] + z); return Number.isFinite(h) ? h - c[1] : null; });
    // ARENA5: by the bout's ladder step where it has one (a ladder bout, a relay's ladder bout, a replay of one), else an
    // exhibition's house - a relay's bout between players, and one watched, have neither `next` nor `ex`, and read here
    // `C.next.tier` / `C.ex.tier` threw before the first await: the stands of a relay's bout stood empty
    const nx = C.next;
    const n = crowdCount({ kind: nx ? 'ladder' : 'exhibition', tier: nx ? nx.tier : C.ex?.tier ?? 0, champion: !!nx?.champion, grand: !!nx?.grand });
    const sat = seatPeople(pickSeats(seats, n, seededRng(arenaHash(C.seed, 3))), seededRng(arenaHash(C.seed, 4)));
    // ARENA5: THE CROWD'S HALF IN YOUR COLOUR (Arena.md 3) - each half of the tiers whose side fights under a banner
    // (systems/arenaCrowd.js crowdHalves, over the banners this bout's own law gave its fighters - boutTeams, relayBanners)
    // is batched apart and washed in its colours; a bout under no banner keeps one batch a picture and phase, as before
    const halves = crowdHalves(C.b?.fighters ?? C.roster, C.teams);
    const split = !!(halves[0] || halves[1]);
    const groups = new Map();
    for (const s of sat) {
      const side = split ? crowdHalfOf(s.x) : 0;
      const k = `${s.archive}:${s.record}:${s.phase < 0.5 ? 0 : 1}:${side}`;
      if (!groups.has(k)) groups.set(k, { archive: s.archive, record: s.record, half: s.phase < 0.5 ? 0 : 1, tint: split ? crowdWash(halves[side]) : null, at: [] });
      groups.get(k).at.push([s.x, s.y, s.z]);
    }
    const batches = [];
    for (const g of groups.values()) {
      let tex;
      try { tex = await deps.getTexture(g.archive); } catch { continue; }
      if (cur !== C) return;
      const size = sizeOf(tex, g.record, CROWD_SCALE[g.archive]);
      const frames = Math.max(1, tex?.getFrameCount?.(g.record) ?? 1);
      const batch = r.createBillboardBatch(g.archive, g.record, size, g.at);
      if (g.tint) batch.tint = g.tint;   // ARENA5: its half's wash (render/renderer.js uBatchTint)
      batches.push({ batch, archive: g.archive, record: g.record, frames, half: g.half, origin: [0, 0, 0], size, uploaded: new Set() });
    }
    if (cur !== C) { for (const x of batches) r.destroyBillboardBatch?.(x.batch); return; }
    C.crowdBatches = batches;
  }
  const sizeOf = (tex, record, scale = null) => {
    try { const s = tex.getSize(record), k = scale == null ? tex.getScale(record) : { width: scale, height: scale }; return { w: (s.width + Math.trunc(s.width * (k.width / 256))) * 0.025, h: (s.height + Math.trunc(s.height * (k.height / 256))) * 0.025 }; } catch { return { w: 1.1, h: 1.95 }; }
  };
  function crowdFrame(C, t) {
    if (!C.crowdBatches.length || !stage) return;
    const c = stage.centre();
    const fps = crowdFlipFps(C.crowd.mood);
    const hop = crowdHop(C.crowd, t);
    for (const x of C.crowdBatches) {
      x.origin[0] = c[0]; x.origin[1] = c[1] + (x.half ? hop : hop * 0.6); x.origin[2] = c[2];
      x.batch.origin = x.origin;
      if (x.frames > 1) {
        const f = Math.floor((t / 1000) * fps + x.half * 0.5 * x.frames) % x.frames;
        if (!x.uploaded.has(f)) { x.uploaded.add(f); deps.uploadRecordFrame?.(x.archive, x.record, f); }
        x.batch.record = `${x.record}#${f}`;
      }
    }
    for (const th of C.throws) {
      const k = Math.min(1, (t - th.at) / THROW_MS);
      const y = th.from[1] + (th.to[1] - th.from[1]) * k + Math.sin(Math.PI * k) * 3;
      th.origin[0] = c[0] + th.from[0] + (th.to[0] - th.from[0]) * k; th.origin[1] = c[1] + y; th.origin[2] = c[2] + th.from[2] + (th.to[2] - th.from[2]) * k;
      th.batch.origin = th.origin;
    }
  }
  /** `count` flats of `kinds` thrown from the stands to the sand round the fighters `ids`. */
  async function throwAt(C, ids, count, kinds) {
    const r = deps.renderer;
    if (!(count > 0) || !r?.createBillboardBatch || !deps.getTexture || !C.crowdBatches.length) return;
    const c = stage.centre();
    const dice = seededRng(arenaHash(C.seed, 9 + count));
    const at = ids.map((id) => C.fighters.get(id)?.ai?.feet ?? null).filter(Boolean).map((f) => [f[0] - c[0], f[2] - c[2]]);
    for (let i = 0; i < count; i++) {
      const [archive, record] = kinds[Math.floor(dice() * kinds.length)];
      let tex;
      try { tex = await deps.getTexture(archive); } catch { return; }
      if (cur !== C) return;
      const size = sizeOf(tex, record);
      const small = { w: size.w * 0.6, h: size.h * 0.6 };
      const a = dice() * Math.PI * 2, r0 = 22 + dice() * 6;
      const target = at.length ? at[Math.floor(dice() * at.length)] : [0, 0];
      const to = [target[0] + (dice() - 0.5) * 5, 0, target[1] + (dice() - 0.5) * 5];
      const batch = r.createBillboardBatch(archive, record, small, [[0, 0, 0]]);
      C.throws.push({ batch, from: [Math.cos(a) * r0, 8, Math.sin(a) * r0], to, at: now() + dice() * 600, origin: [0, 0, 0] });
    }
  }
  /** The crowd's and the throws' batches, for the host's billboard pass. */
  function batches() {
    if (!cur) return [];
    const out = [];
    for (const x of cur.crowdBatches) out.push(x.batch);
    for (const th of cur.throws) out.push(th.batch);
    return out;
  }

  // ── ARENA4: A BOUT THE RELAY RUNS ────────────────────────────────────────────────────────────────────
  /**
   * STAND A RELAY'S BOUT on this screen's floor: a bout between players (`kind` 'pvp' - my opponent another player's body,
   * drawn by the room's poses), a ladder bout against the relay's own fighters ('pve' - each a puppet of its walk and its
   * blows), or a bout watched from the stands (`me` ''). Nothing here decides anything: the relay's words (`relayWord`)
   * move a mirror of its bout (net/arenaLink.js), which the crowd, the Herald, the HUD and the music read as they read a
   * bout run here. `send` the doors back to the relay: `hit(word)`, `yield()`. ARENA4b: and `cheer(dir)` from the stands;
   * `banners` each fighter's banner as the hall billed it (by fighter id); `owe(gold, pay)` a ladder win's purse held for
   * the account service's word (`pay` pays it) - without it the purse is paid at the verdict.
   * @param {{ o: string, kind: 'pvp'|'pve', me?: string, next?: any, send?: { hit?: (w: any) => boolean, yield?: () => boolean, cheer?: (dir: number) => boolean },
   *   names?: (i: number, mobile: number) => any, onEnd?: (r: any) => void, struck?: (d: number) => void, myHealth?: (hp: number, max: number) => void,
   *   banners?: Record<string, string|null>, owe?: (gold: number, pay: (g: number) => void) => void }} p
   */
  function startRelay(p) {
    if (!stage) { pending = { where: 'floor', relay: p }; return null; }
    dismiss();
    const t = now();
    cur = {
      kind: 'relay', relay: p, id: p.o, seed: 0, stage, ladder: !!p.me, next: p.next ?? null, ex: null, fighters: new Map(), tags: new Map(), marks: [],
      roster: [], b: null, crowd: null, you: p.me || null, playerTag: null, practice: false, quiet: false, ring: stage.radius ?? RING_R,
      lastBlow: new Map(), walking: new Set(), lastHealth: P?.health ?? 0, lastSheathed: null, verdictAt: NaN, doneAt: NaN, paid: false,
      said: false, crowdSeats: null, crowdBatches: [], throws: [], spawning: 0, title: false, startedAt: t, bark: '', barkAt: -Infinity,
      ringed: null, teams: {}, clock: { off: null }, mv: new Map(), M: null, spawned: false,
      cheerAt: -Infinity, ownShout: null,   // ARENA4b: my last cheer from the stands, and its echo still to come
    };
    return cur;
  }
  /** ARENA4b: THE BANNERS ON A RELAY'S SAND - mine the account's (the realm's `banner`, when I fight), the others' as the
   *  hall billed them (`banners` by fighter id - a rival's, a watched bout's two; none for the relay's own fighters), each
   *  a pennant on the versus bar (`data-team`), and the realm's laurel favoured from the first bell. */
  function relayBanners(C) {
    // the merge of ARENA4b's streams: an EXHIBITION's sides are its own - the Red's fighter against the Blue's
    // (startExhibitionRelay), its laurel exhibitionWord's - and this, run on every relay bout's first `st`, wiped both
    if (C.ex) return;
    const R = realmNow();
    /** @type {Record<string, string>} */
    const out = {};
    for (const [id, b] of Object.entries(C.relay.banners ?? {})) if (b === 'red' || b === 'blue') out[id] = b;
    if (C.you && (R?.banner === 'red' || R?.banner === 'blue')) out[C.you] = R.banner;
    C.teams = out;
    laurelOf(C, R?.laurel ?? null, out);
  }
  /** ARENA4b: MY CHEER (`dir` 1) OR BOO (-1) from the stands of a relay's bout - one each CHEER_GAP_MS - sent through the
   *  bout's session (`send.cheer`, scenes/arenaOnline.js) and heard by my own crowd at once, by the stands' own law
   *  (systems/arenaCrowd.js crowdShout, one voice), as every screen hears the relay's `cr`; the relay's echo of it is
   *  then heard only for whoever shouted with me (`relayWord`'s `cr`). Answers whether it went. */
  function cheer(dir) {
    const C = cur;
    if (!C?.relay || C.you || !C.b || !C.crowd || boutOver(C.b) || (dir !== 1 && dir !== -1)) return false;
    const t = now();
    if (t - C.cheerAt < CHEER_GAP_MS) return false;
    if (C.relay.send?.cheer?.(dir) !== true) return false;
    C.cheerAt = t;
    C.ownShout = { c: dir, at: t };
    deps.sound?.cue(crowdShout(C.crowd, dir, 1, t), 1);
    return true;
  }
  /** The stands' door for the HUD's presses (ui/arenaHud.js drawArenaHud `cheer`), one function for every frame. */
  const cheerDoor = (dir) => cheer(dir);
  /** A RELAY'S WORD on the bout standing here (one of `startRelay`'s): its whole state, its events, its health, its
   *  fighters' walks and blows, the stands' shouts. Answers whether it was this bout's. */
  function relayWord(w) {
    const C = cur;
    if (!C?.relay || !w) return false;
    const t = now();
    const near = C.near ?? 1;   // ARENA4b: the city's sand heard from the market by distance (relayFrame), the instance's whole
    if (w.k === 'st') {
      if (w.o !== C.relay.o) return false;
      const first = !C.M;
      C.M = mirrorOf(w, t, { prev: C.M, off: C.clock.off ?? 0, names: C.relay.names ?? (() => null) });
      C.b = C.M.b; C.seed = C.M.seed; C.you = C.M.me || null; C.ladder = !!C.you;
      if (first) {
        C.crowd = newCrowd({ fighters: C.b.fighters.map((f) => ({ id: f.id, home: f.home, ai: f.ai })), beasts: !!C.next?.beasts });
        relayBanners(C);   // ARENA4b: the realm's banners and its laurel, from the first bell
        if (C.you) { C.playerTag = { id: C.relay.o, side: C.b.fighters.find((f) => f.id === C.you)?.side ?? 0, out: false, hold: true }; deps.setPlayerBout?.(C.playerTag); }
        buildCrowd(C);
        for (const a of C.M.ai) spawnPuppet(C, a);
      }
      return true;
    }
    if (!C.b) return w.k === 'mv' ? (C.mv.set(w.i, w), true) : false;
    switch (w.k) {
      case 'ev': for (const e of mirrorEvents(C.M, w.e, t, C.clock)) hear(C, e, t, near); break;
      case 'hp': {
        const mine = mirrorHealth(C.M, w.h);
        if (mine && P) {
          // MY HEALTH IS THE RELAY'S: its share of my whole, on my own scale, never under the breath of life
          const [hp, max] = mine;
          const h = Math.max(1, Math.round((hp / Math.max(1, max)) * Math.max(1, P.maxHealth ?? 1)));
          if (h < (P.health ?? h)) C.relay.struck?.(Math.round((P.health ?? h) - h));
          C.relay.myHealth?.(h, P.maxHealth ?? h);
          C.lastHealth = h;
        }
        break;
      }
      case 'mv': C.mv.set(w.i, w); break;
      case 'atk': {
        const foe = C.fighters.get(w.i);
        if (foe?._pup) { foe._pup.strike = 'melee'; foe._pup.yaw = Math.atan2(w.x - (foe.ai?.feet?.[0] ?? w.x), w.z - (foe.ai?.feet?.[2] ?? w.z)); }
        break;
      }
      case 'blow': break;   // what it took is the next `hp`'s (the relay holds my health); its sound is the puppet's swing
      case 'cr': {
        // ARENA4b: MY OWN SHOUT COME BACK (the first of its direction inside the relay's allowance): my crowd heard my
        // voice at the press, so only the others who shouted with me are heard now - as every other screen heard us all
        const own = C.ownShout && C.ownShout.c === w.c && t - C.ownShout.at <= ARENA_CHEER_MS;
        if (own) C.ownShout = null;
        const n = own ? w.n - 1 : w.n;
        if (n > 0) deps.sound?.cue(crowdShout(C.crowd, w.c, n, t), near);
        break;
      }
      default: return false;
    }
    return true;
  }
  /** A relay's fighter stood as a PUPPET (scenes/dungeonContext.js puppetStep): the stage's own body for its mobile,
   *  owned by ARENA_PUPPET_OWNER - no senses, no swing of its own, its feet and its blows the relay's words. */
  function spawnPuppet(C, a) {
    const mv = C.mv.get(a.id);
    const at = mv ? relayToStage(C, mv.x, mv.z) : null;   // ARENA4b: the relay's frame on this stage (the city's sand too)
    const c = stage.centre();
    const feet = at ? [at[0], c[1], at[1]] : [c[0], c[1], c[2]];
    const who = C.b.fighters.find((f) => f.id === a.id);
    // ARENA4b: an exhibition's fighter struck from the stands answers as this screen's would (the Herald, then the watch)
    const tag = { id: C.relay.o, side: who?.side ?? 1, out: false, hold: true, hooks: C.ex ? { intrude: (foe) => intrude(a.id, foe) } : {} };
    C.tags.set(a.id, tag);
    C.spawning++;
    // ARENA4b: `mirror` - a body every screen stands its own copy of (the city's pool streams it to nobody)
    Promise.resolve(stage.spawn(a.mobile, feet, { level: null, gender: C.relay.names?.(a.i, a.mobile)?.gender, yaw: Math.atan2(c[0] - feet[0], c[2] - feet[2]), bout: tag, mirror: true }))
      .then((foe) => {
        C.spawning--;
        if (cur !== C || !foe) { if (foe) stage?.remove?.(foe); return; }
        foe._ownFrom = ARENA_PUPPET_OWNER; foe._ownI = a.i;
        foe._pup = { feet: [...foe.ai.feet], yaw: foe.ai.yaw ?? 0, moving: false, strike: null, target: '', cast: null };
        if (foe.entity) { foe.entity.bout = tag; foe.entity.items = []; }
        if (foe.ai) { foe.ai.isHostile = false; foe.ai.target = null; }
        C.fighters.set(a.id, foe);
      })
      .catch(() => { C.spawning--; });
  }
  /** One frame of a relay's bout: its puppets on their walks, my yield, the HUD, the crowd. */
  function relayFrame(C, dt, o, t) {
    if (!C.b) { deps.drawHud?.(null, { hidden: true }); return; }
    const off = C.clock.off ?? 0;
    const c = stage?.centre?.() ?? null;
    // ARENA4b: the city's sand is heard and its HUD shown by the distance from it (an exhibition watched from the market)
    const near = C.near = C.stage?.kind === 'city' ? (c && o.playerFeet ? nearOf(Math.hypot(o.playerFeet[0] - c[0], o.playerFeet[2] - c[2])) : 0) : 1;
    if (C.stage?.kind === 'city') cityBodiesFrame(C, t, off);   // ARENA4b: the exterior's own bodies, walked by their motor
    for (const [id, foe] of C.fighters) {
      const mv = C.mv.get(id);
      if (!mv || !foe._pup || !c) continue;
      const w = walkAt(mv, t, off);
      const p = w ? relayToStage(C, w[0], w[1]) : null;   // ARENA4b: on this stage's frame
      if (!p) continue;
      foe._pup.feet[0] = p[0]; foe._pup.feet[2] = p[1];
      if (Number.isFinite(foe.ai?.feet?.[1])) foe._pup.feet[1] = foe.ai.feet[1];
      foe._pup.moving = !walkDone(mv, t, off);
      if (foe._pup.moving) foe._pup.yaw = Math.atan2(mv.tx - mv.x, mv.tz - mv.z);
      const f = boutFighter(C.b, id);
      if (f?.out) { foe._pup.moving = false; standDown(foe); }
    }
    // THE YIELD: the blade sheathed at the line, said to the relay (the law there refuses it above the line)
    const you = C.you ? boutFighter(C.b, C.you) : null;
    if (you && o.sheathed != null) {
      if (C.lastSheathed === false && o.sheathed === true && boutLive(C.b) && !you.out) {
        if (fighterShare(you) > YIELD_SHARE) deps.say?.(ARENA_TEXT.refuse.yieldEarly);
        else C.relay.send?.yield?.();
      }
      C.lastSheathed = !!o.sheathed;
    }
    if (C.playerTag) { C.playerTag.hold = !boutLive(C.b); if (you?.out || boutOver(C.b)) C.playerTag.out = true; }
    crowdTick(C.crowd, dt);
    deps.sound?.bed(C.crowd.mood, near);
    if (C.b.phase === 'done' && !Number.isFinite(C.doneAt)) C.doneAt = t;
    if (Number.isFinite(C.doneAt) && t - C.doneAt >= LEAVE_AFTER_MS && C.fighters.size) {
      for (const foe of C.fighters.values()) stage?.remove?.(foe);
      C.fighters.clear();
      deps.setPlayerBout?.(null);
    }
    if (Number.isFinite(C.doneAt) && t - C.doneAt >= CROWD_STAYS_MS && C.stage?.kind === 'city') { dismiss(); return; }   // ARENA4b: the city's crowd goes home, as this screen's own bout's
    const bark = t - C.barkAt < BARK_SHOWN_MS ? C.bark : '';
    // ARENA4b: in the stands, the two presses (Cheer, Boo) under the plate - shut while the allowance runs
    const stands = C.you ? null : { ready: t - C.cheerAt >= CHEER_GAP_MS };
    deps.drawHud?.(near > 0 ? arenaHudModel(C.b, C.crowd, t, { you: C.you, stamina: o.stamina ?? null, bark, quiet: false, teams: C.teams, stands }) : null, { hidden: !!o.hidden, touch: !!o.touch, cheer: C.you ? null : cheerDoor });
    crowdFrame(C, t);
  }
  /** THE VERDICT of a relay's bout: the Herald's words; a ladder win's purse (the relay refereed it - the account's climb
   *  is the account service's, told by the receipt); the stands' throw. */
  function relayVerdict(C, t) {
    const r = C.b.result;
    C.verdictAt = t;
    if (!r) return;
    const V = ARENA_TEXT.verdict;
    const w = r.side === null ? '' : sideNames(C.b, r.side), l = r.side === null ? '' : otherNames(C.b, r.side);
    const line = r.side === null ? V.draw : r.how === 'judges' ? V.judges(w) : r.how === 'yield' ? V.yield(w, l) : r.how === 'ringout' ? V.ringout(w, l) : r.how === 'forfeit' ? V.forfeit(w, l) : V.fall(w, l);
    deps.say?.(line);
    const throws = verdictThrows(C.crowd, r.winners, r.losers);
    throwAt(C, r.winners, throws.flowers, THROWN_FLOWERS);
    throwAt(C, [...r.losers, ...r.winners], throws.refuse, THROWN_REFUSE);
    const mine = C.you ? boutFighter(C.b, C.you) : null;
    const won = !!mine && r.side === mine.side;
    const lines = [line];
    if (C.relay.kind === 'pve' && mine) {
      const purse = won ? boutPurse(C.next?.purse ?? 0, C.crowd.favour[C.you] ?? 0) : 0;
      // ARENA4b: online the purse waits on the account service's word (`owe` - scenes/arenaOnline.js): paid only for the
      // bout the account was owed, never for a win the realm refuses (out of the climb's order)
      if (won && purse > 0 && !C.paid) { C.paid = true; if (C.relay.owe) C.relay.owe(purse, (g) => deps.pay?.(g)); else deps.pay?.(purse); }
      lines.push(won ? ARENA_TEXT.purse.won(purse) : ARENA_TEXT.purse.lost);
      if (won && C.next?.grand) lines.push(V.grand(P?.name || 'You'));
      else if (won && C.next?.champion) lines.push(V.tier(P?.name || 'You', ARENA_TEXT.tiers[C.next.tier]));
    }
    C.relay.onEnd?.({ won, side: r.side, how: r.how, lines });
    if (mine) deps.notice?.(lines);
  }

  // ── ARENA4b: THE HOUR'S EXHIBITION, THE RELAY'S ─────────────────────────────────────────────────────────
  /**
   * THE RELAY'S EXHIBITION STOOD HERE (Arena.md 2: "the relay runs it, every client sees one bout"): a relay's bout
   * watched from the stands (startRelay, `me` '') on the city's sand or the floor's instance, carrying the hour's
   * exhibition (`ex` - net/arenaExhibition.js exhibitionFor) so the window, the Herald, the book and the music read it as
   * the hour's: its Red against its Blue on the versus bar, the exhibition's call, the purse's bark and - at its verdict -
   * the bookmaker told what the relay decided (`exhibitionVerdict`, the local bout's own door).
   * @param {{ o: string, ex: any, names?: (i: number, mobile: number) => any, onEnd?: (r: any) => void }} p
   */
  function startExhibitionRelay(p) {
    const ex = p.ex;
    const C = startRelay(/** @type {any} */ ({
      ...p, kind: 'ex', me: '', next: null, send: {},
      onEnd: (r) => {
        if (cur === C && r.side !== null) { C.bark = ARENA_TEXT.purse.won(EXHIBITION_PURSE); C.barkAt = now(); }
        deps.exhibitionVerdict?.(ex.hour, r.side);   // the bookmaker settles by the relay's verdict
        p.onEnd?.(r);
      },
    }));
    if (!C) return null;
    C.ex = ex;
    C.teams = { a0: 'red', a1: 'blue' };   // ARENA3's exhibition: the Red's fighter (side 0) against the Blue's
    return C;
  }
  /** A RELAY'S WORD on the exhibition standing here: the bout's own (relayWord), and what an exhibition adds - the beast
   *  tier's sour crowd and the laurel's favour on its first `st`, and on the city's sand a telegraphed blow as the body's
   *  own swing (the exterior's pool draws a strike off its attack's count). Answers whether it was this bout's. */
  function exhibitionWord(w) {
    const C = cur;
    if (!C?.relay || !C.ex) return relayWord(w);
    const first = w?.k === 'st' && !C.M && w.o === C.relay.o;
    const ok = relayWord(w);
    if (first && C.crowd) {
      if (C.ex.beasts && !C.crowd.beasts) C.crowd = newCrowd({ fighters: C.b.fighters.map((f) => ({ id: f.id, home: f.home, ai: f.ai })), beasts: true });
      laurelFavour(C);   // ARENA3's laurel: the crowd favours last season's winning banner's fighter from the first bell
    }
    if (ok && w.k === 'atk' && C.stage?.kind === 'city') {
      const foe = C.fighters.get(w.i);
      if (foe?.attack && foe.ai?.feet) {
        const [tx, tz] = relayToStage(C, w.x, w.z);
        foe.ai.walkGoal = null;
        foe.ai.yaw = Math.atan2(tx - foe.ai.feet[0], tz - foe.ai.feet[2]);
        foe.attack.firedRanged = false;
        foe.attack.swingSeq = (foe.attack.swingSeq | 0) + 1;
      }
    }
    return ok;
  }
  /** A place in the relay's frame (the floor's instance's - net/arenaLaw.js ARENA_FLOOR_CENTRE) on this bout's stage: the
   *  instance's as it is, the city's the same offset from its own sand's centre (the driver lays both floors' marks so). */
  function relayToStage(C, x, z) {
    if (C.stage?.kind !== 'city') return [x, z];
    const c = C.stage.centre();
    return [c[0] + (x - ARENA_FLOOR_CENTRE[0]), c[2] + (z - ARENA_FLOOR_CENTRE[2])];
  }
  /** THE RELAY'S FIGHTERS ON THE CITY'S SAND: bodies of the exterior's own pool (no puppet lane there), each walked by
   *  its own motor (characters/enemyMotor.js walkTo) after the relay's walk, stood where the relay has it once it falls
   *  CITY_SNAP_M behind, stood down once out. Its bout tag holds it - it targets nobody, so no swing of it lands. */
  function cityBodiesFrame(C, t, off) {
    for (const [id, foe] of C.fighters) {
      const ai = foe.ai, mv = C.mv.get(id);
      if (!ai?.feet || !mv) continue;
      if (boutFighter(C.b, id)?.out) { ai.walkGoal = null; standDown(foe); continue; }
      const w = walkAt(mv, t, off);
      if (!w) continue;
      const [px, pz] = relayToStage(C, w[0], w[1]);
      const f = ai.feet;
      if (Math.hypot(px - f[0], pz - f[2]) > CITY_SNAP_M) { f[0] = px; f[2] = pz; ai.walkGoal = null; continue; }
      if (!walkDone(mv, t, off)) {
        const [gx, gz] = relayToStage(C, mv.tx, mv.tz);
        if (!ai.walkGoal || Math.hypot(ai.walkGoal[0] - gx, ai.walkGoal[2] - gz) > MARK_ARRIVE_M) ai.walkTo?.([gx, f[1], gz], { pace: 1 });
      } else if (!ai.walkGoal && Math.hypot(px - f[0], pz - f[2]) > MARK_ARRIVE_M) ai.walkTo?.([px, f[1], pz], { pace: WALK_PACE });
    }
  }

  // ── THE END OF IT ───────────────────────────────────────────────────────────────────────────────────────
  /** The bout gone, unsaid (its stage went, or another took its place): its fighters off the sand, its crowd and its
   *  sound let go, the HUD hidden. */
  function dismiss() {
    const C = cur;
    if (!C) return;
    cur = null;
    for (const foe of C.fighters.values()) C.stage?.remove?.(foe);
    C.fighters.clear();
    for (const x of C.crowdBatches) deps.renderer?.destroyBillboardBatch?.(x.batch);
    for (const th of C.throws) deps.renderer?.destroyBillboardBatch?.(th.batch);
    C.crowdBatches = []; C.throws = [];
    deps.setPlayerBout?.(null);
    deps.sound?.stop();
    deps.drawHud?.(null, { hidden: true });
    intrusions = 0;
  }

  return {
    setStage, ask, start, dismiss, frame, batches, playerSpare, holds, attackResolved, playerSwing,
    startRelay, relayWord,   // ARENA4: a bout the relay runs
    cheer,   // ARENA4b: my cheer or boo from the stands of a relay's bout
    floorBanners,   // ARENA5: the banners the floor's instance hangs for the bout asked for it
    askReplay,   // ARENA5: a recorded ladder bout watched from the stands
    /** ARENA5: whether the bout standing (or asked) is a replay. */
    replaying: () => !!(cur?.relay?.replay ?? pending?.relay?.replay),
    /** ARENA4b: the realm's banners' source while online (`() => ({ banner, laurel }) | null`), scenes/arenaOnline.js's. */
    setRealm: (fn) => { realmOf = typeof fn === 'function' ? fn : null; },
    startExhibitionRelay, exhibitionWord,   // ARENA4b: the hour's exhibition, the relay's
    /** ARENA4: the relay's bout standing here - its id, my fighter id ('' in the stands), its kind - or null. */
    relay: () => (cur?.relay ? { o: cur.relay.o, me: cur.you ?? '', kind: cur.relay.kind } : null),
    /** The ring the motor keeps me in while my bout stands (player/motor.js `arena`), or null. */
    ring: () => {
      if (!holds() || !stage || cur.stage !== stage) return null;
      const c = stage.centre();
      const r = (cur.ringed ??= { centre: [0, 0, 0], radius: cur.ring ?? RING_R });
      r.centre[0] = c[0]; r.centre[1] = c[1]; r.centre[2] = c[2];
      return r;
    },
    /** What the floor plays now (systems/arenaScore.js), or null (no bout heard here). */
    scoreWant: (t = now()) => (cur?.b && !cur.quiet ? arenaScoreFor(cur.b.phase, cur.verdictAt, t) : null),   // the pit has no band
    /** The bout standing (its law's state), its crowd, its kind, its stage's kind. */
    bout: () => cur?.b ?? null,
    crowd: () => cur?.crowd ?? null,
    kind: () => cur?.kind ?? null,
    stageKind: () => cur?.stage?.kind ?? null,
    pending: () => pending,
    /** The names on the sand now, for the Herald ("On the sand now: A against B"), or null. */
    onSand: () => (cur?.b && !boutOver(cur.b) ? { a: sideNames(cur.b, cur.b.fighters[0].side), b: otherNames(cur.b, cur.b.fighters[0].side) } : null),
    /** The hour whose exhibition stands here (the world host's schedule reads it). */
    hour: () => cur?.ex?.hour ?? null,
  };
}
