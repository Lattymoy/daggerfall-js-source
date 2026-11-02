// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SEA VENTURES (2026-10-22, the owner: "Build ever single bit of this and dont return until its perfected" - the Eltheric
// Ocean's reasons to venture; bible/03-World/Eltheric-Ocean.md SEA-VAULTS and the sections after it) - THE SEA'S WIRING in
// the streaming world: what the world host (scenes/world.js) asks of the sea's ventures, in a module of its own (HOST-SPLIT:
// fishHost.js's shape - the host wires, this holds).
//
//   THE VAULTS (SEA-VAULTS): the day's vaults of the deep (systems/sea/seaVaults.js) while the open sea is an open zone -
//   the one the player stands at (`vaultHere`: the door's hall, the mountains' gate's - its hub lock, its epoch, its
//   high-tier foes), the chart's marks (`chartWord`: each vault, its crows, my padlock) and the crows' news (`crowLine`);
//   and where the open sea is (`openSeaAt` - nothing keeps an instance there, as in the mountains).
//
//   THE EVENTS (SEA-EVENTS, systems/sea/seaEvents.js - the shared clock's): the Aether Storm - its weather over the player
//   (`stormWord`, the world's shown weather), its wrack (`wrackSites`, `gather` - the naval host's sites and casks), its
//   lightning on the ship (`step`, off the world's strikes) and its words; the treasure fleet - its ships fed to the naval
//   host (`step`), its flagship's purse and the hub's word that it is down (`fleetEnded`, `hubWord`), its words; both on the
//   chart (`chartWord`) and in a freeport harbourmaster's talk (`rumours`).
//
//   THE OPEN SEA'S GUNS (SHIP-PVP, scenes/naval/seaBroadsides.js and scenes/seaWreckHost.js): broadsides between captains
//   past Veilhaven's peace, refereed by the relay - attached to the naval host, stepped here, the referee's words heard
//   (`wref`), a wreck's receipt carried to the service.
//
//   A FREEPORT HARBOURMASTER'S BOARDS (`office` - the tab's sections, spread into its model): the Wanted section
//   (SEA-BOUNTY, scenes/seaBountyHost.js - `wanted`) and the season's captains (SEA-SEASON, scenes/seaSeasonHost.js -
//   `season`).
//
// deps = {
//   live() -> bool          the open sea is an open zone now (online, at a relay that raises it, the sea standing)
//   day() -> number         the relay's day (world.js wdunDayNow - the halls' own)
//   pixel() -> { x, y }     the player's map pixel (a building's or a dungeon's: its door's)
//   locks: Map              the hub's word on my locks, key -> until (world.js _wdunLocks)
//   crows: Map              the crows over every hall, key -> until (world.js _wdunCrows)
//   mine() -> { dungeon, until } | null   my own remains (world.js _wildMine) - a lock never shuts my way back to them
//   clock() -> ms           the shared clock (world.js raidNowMs - the relay's, offline this machine's)
//   naval() -> host | null  the naval host (fleet, stormStrike), when the sea fight runs
//   state                   the streaming world's state (localFromWorld - a map pixel in the scene)
//   link() -> OnlineSession | null   the social socket (sendWdun, wdunSeaOk)
//   ether                   the ether host (scenes/etherHost.js): credit(n), mid(text, s), say(text, s)
//   session, checkpoint, wallet, character, region   SEA-BOUNTY's (scenes/seaBountyHost.js): the realm session, its
//                           checkpoint, the record's wallet, the realm character (its own - systems/characterId.js
//                           characterIdOf, when none is given), the region stood in
//   bountyDoor?             the bounty board's service door (its own, when none is given)
//   seasonDoor?             the season boards' service door (its own, when none is given)
//   cell() -> OnlineSession | null   SHIP-PVP's: my cell's socket (sendWild, `id`, `acct`, `seaPvpOk`, a peer's name)
//   foe(id) -> bool         SHIP-PVP's: a peer outside my party and guild (world.js wildIsStranger)
//   name?(id) -> string     SHIP-PVP's: a peer's name, as shown (its own - the socket's peer's, when none is given)
// }
// ═══════════════════════════════════════════════════════════════════
import { inEther, etherBandAt, compassPoint } from '../world/ethericSea.js';
import { seaVaultPicks, seaVaultAt, seaVaultByKey } from '../systems/sea/seaVaults.js';
import { seaVaultCell } from '../net/wire.js';
import { etherRingName, etherWildRingAt } from '../systems/wild/etherWild.js';
import { stormAt, stormHere, stormEye, nextStorm, stormWrackSlot, wrackOf, stormStrikeOf, fleetAt, nextFleet, fleetPlace, fleetOf } from '../systems/sea/seaEvents.js';
import { rollElthericPiece, elthericChance } from '../systems/aetheric.js';
import { setById } from '../systems/sigil/sigilSets.js';
import { mintGood, goodById } from '../systems/naval/tradeGoods.js';
import { STRAND_SITE, STRAND_YIELD } from './etherHost.js';
import { NATIVE_PIXEL } from '../systems/seaRaiders.js';
import { createSeaBounty } from './seaBountyHost.js';
import { createSeaSeason } from './seaSeasonHost.js';
import { createSeaBroadsides } from './naval/seaBroadsides.js';
import { createSeaWreckHost } from './seaWreckHost.js';
import { wildHere, wildZoneKind } from '../systems/wild/wildZone.js';
import { ETHER_KIND, etherWayWord } from '../systems/wild/etherWild.js';
import { t } from '../systems/textManager.js';
import { characterIdOf } from '../systems/characterId.js';
import { playerEntity } from '../characters/playerEntity.js';

/** SEA-EVENTS: a storm's wrack site's id - a strand's, so the naval host floats and hauls it as one (`strand:wrack:n:slot`). */
export const WRACK_SITE = `${STRAND_SITE}wrack:`;
/** SEA-EVENTS: the fleet's feed to the naval host this often (ms - the lanes' own). */
export const FLEET_FEED_MS = 500;
/** SEA-EVENTS: each ship of the fleet steers for her station this far on (ms of the clock). */
export const FLEET_LEAD_MS = 60_000;
/** AUDIT SEA VENTURES D5: a sinking of mine the hub has not said is told it again this often (ms of the clock). */
export const FLEET_TELL_MS = 30_000;
/** A band's name in a sentence: its name, the article as it stands ("The Abyss" - parenthesised, never declined: a
 *  language that declines it cannot fold it into a sentence, as the crows' line found). */
const bandName = (id) => etherRingName(['shallows', 'reaches', 'deep', 'abyss'].indexOf(id) + 1);

/** SEA-EVENTS: the Aether Storm's word over the player as the sea's step last turned it - the world's shown weather reads
 *  it (scenes/world.js shownWeather: 'thunder', or null), a module's word so the weather may ask before the host is built. */
let _stormShown = null;
export const seaStormShown = () => _stormShown;

/** A name opening a sentence, its first letter raised ("the Isle of X" leads as "The Isle of X"). */
const capFirst = (s) => String(s ?? '').replace(/^./, (c) => c.toUpperCase());

/** @param {any} deps */
export function createSeaVentures(deps) {
  const live = () => !!deps.live?.();
  /** The open sea at map pixel `p` (`{ x, y }`): live, and past Veilhaven's peace inside the sea's box - where nothing keeps
   *  an instance (scenes/instanceDoor.js `wild`, the mountains' own rule). */
  const openSeaAt = (p) => live() && !!p && etherWildRingAt(p.x, p.y) > 0;
  /** The day's vaults of the deep, while the open sea is an open zone - none otherwise. */
  const vaultsNow = () => (live() ? seaVaultPicks(deps.day()) : []);
  /** The vault whose ruin stands at the player's pixel today, or null. */
  function vaultHere() {
    if (!live()) return null;
    const p = deps.pixel?.();
    if (!p || !inEther(p.x, p.y)) return null;
    return seaVaultAt(vaultsNow(), p.x, p.y);
  }
  const myWayBack = (key, now) => { const m = deps.mine?.(); return !!m && m.dungeon === key && m.until > now; };
  /** The chart's word of the sea's ventures: the open sea's fights (`pvp`) and the day's vaults - each its place, its
   *  name and band, my padlock on it (my lock still shuts it, and no remains of mine lie in it) and its crows. */
  function chartWord(now = Date.now()) {
    return {
      pvp: live(),
      vaults: vaultsNow().map((v) => ({
        key: v.key, x: v.x, y: v.y, name: v.name, band: v.band, ring: v.ring,
        locked: (deps.locks?.get(v.key) ?? 0) > now && !myWayBack(v.key, now), crows: !!deps.crows?.has(v.key),
      })),
    };
  }
  /** THE CROWS' NEWS of a vault of the deep (`"e<cx>,<cy>"`): its name and its band - today's vault or yesterday's (a body
   *  lies twelve minutes past the day's turn) - or, a vault no day names, the sea's own words; null for a mountain hall. */
  function crowLine(h) {
    if (!seaVaultCell(h)) return null;
    const d = Number(deps.day?.()) || 0;
    const v = seaVaultByKey(vaultsNow(), h) ?? (live() ? seaVaultByKey(seaVaultPicks(d - 1), h) : null);
    return v
      ? t('sea.vault.crows', 'Crows gather over {name} ({band}). Someone has fallen there.', { name: capFirst(v.name), band: etherRingName(v.ring) })
      : t('sea.vault.crowsAnon', 'Crows gather over a vault of the deep. Someone has fallen there.');
  }
  // ── SEA-EVENTS ─────────────────────────────────────────────────────────────────────────────────────────────────────
  const clock = () => Number(deps.clock?.()) || Date.now();
  /** A map point (fractional pixels, a pixel's middle at its half) in the scene, `[x, z]`. */
  const toScene = (x, y) => deps.state?.localFromWorld?.(x * NATIVE_PIXEL, (500 - y) * NATIVE_PIXEL) ?? null;
  const mid = (text, s) => deps.ether?.mid?.(text, s), say = (text, s) => deps.ether?.say?.(text, s);
  const atSea = (p = deps.pixel?.()) => !!p && inEther(p.x, p.y);
  /** The middle of a map pixel - the events' points are the chart's, a pixel's middle at its half (`{ x, y }` in, out). */
  const centre = (p) => ({ x: p.x + 0.5, y: p.y + 0.5 });
  /** The storm over the player's pixel now, or null. */
  const stormOver = (p, now) => (p ? stormHere(p.x + 0.5, p.y + 0.5, now) : null);
  /** THE STORM OVER THE PLAYER: a thunderstorm while they stand in it at sea (the world's shown weather), else null. */
  const stormWord = () => (stormOver(deps.pixel?.(), clock()) ? 'thunder' : null);
  /** The shown word moved into the storm or out of it since it was last asked (the world's crossing - a short front);
   *  the word kept for the world's shownWeather (seaStormShown). */
  const stormTurned = () => { const w = stormWord(); if (w === _stormShown) return false; _stormShown = w; return true; };
  const wracked = new Set();   // the wrack's casks hauled this session - a slot's once (AUDIT SEA VENTURES D6: and the save's, the ether host's ledger)
  const hauled = (id) => wracked.has(id) || !!deps.ether?.wrackHauled?.(id);
  /** THE STORM'S WRACK: inside the storm at sea, a cask alongside each STORM_WRACK_MS (its slot) not yet hauled - a strand's
   *  site of the naval host's (`{ id, kind: 'strand', px, py, seed, n: 1, word }`), floated alongside and hauled as one. */
  function wrackSites(px, py) {
    const now = clock(), s = stormOver({ x: px, y: py }, now);
    if (!s) return [];
    const slot = stormWrackSlot(s, now), id = `${WRACK_SITE}${s.n}:${slot}`;
    if (hauled(id)) return [];
    return [{ id, kind: 'strand', px, py, seed: (s.n * 977 + slot) >>> 0, n: 1, word: t('sea.storm.wrack', 'The storm throws up wrack. A cask bobs in the swell alongside.') }];
  }
  /** A cask of the storm's wrack hauled (the naval host's strand haul): one of the sea's goods by the band it floated in,
   *  and on the band's share a piece of the Tidemail (ELTHERIC_CHANCE.storm). `{ items, text }`, or null for a strand of
   *  an isle's own (the ether host's). */
  function gather(siteId) {
    const m = /^strand:wrack:(\d+):(\d+)$/.exec(String(siteId ?? ''));
    if (!m) return null;
    const id = String(siteId);
    if (hauled(id)) return { items: [], text: '' };
    wracked.add(id);
    deps.ether?.haulWrack?.(id);   // D6: kept in the save - a reload floats it never again
    const p = deps.pixel?.(), band = p && inEther(p.x, p.y) ? etherBandAt(p.x).id : 'deep';
    const w = wrackOf(Number(m[1]), Number(m[2]), band, STRAND_YIELD);
    const g = goodById(w.good), items = [mintGood(w.good, w.n)];
    const piece = rollElthericPiece(w.rolls, elthericChance('storm', band));
    if (piece) items.push(piece);
    const haul = t('sea.storm.wrackHaul', '{n} {unit} of {good} from the storm\'s wrack.', { n: w.n, unit: w.n === 1 ? g?.unit ?? '' : g?.units ?? '', good: String(g?.name ?? '').toLowerCase() });
    return { items, text: piece ? `${haul} ${t('sea.storm.wrackTidemail', 'In the wrack: {piece}, a piece of {set}!', { piece: piece.name, set: setById('eltheric')?.name ?? '' })}` : haul };
  }
  const sunk = new Set();   // the sailings whose flagship is down, the hub's word
  const mine = new Set();   // AUDIT SEA VENTURES D5: the sailings whose flagship I ended - never put out by the hub's word, told it until it says so
  /** A sailing's flagship down: the hub's word, mine, or my ledger's (AUDIT SEA VENTURES D4: a reload stood her again). */
  const down = (n) => sunk.has(n) || mine.has(n) || !!deps.ether?.fleetDone?.(n);
  /** My word to the hub that a sailing's flagship went down (online, at a relay that reads it) - whether it left. */
  const tellHub = (n) => { const link = deps.link?.(); return !!link?.wdunSeaOk && link.status === 'open' && link.sendWdun({ k: 'fk', n }) === true; };
  let fkAt = -Infinity;
  let fedAt = -Infinity, heardStorm = null, heardFleet = null, inStorm = null, strikesSeen = null;
  /** The way from the player's pixel to a point, in words ("west-north-west"), or '' where they stand on it. */
  const wayTo = (p, q) => (p && q ? etherWayWord(compassPoint(q.x - centre(p).x, q.y - centre(p).y)) : '');   // AUDIT SEA VENTURES F4: in the language of the moment
  /** THE FLEET'S FEED: the sailing under way, each ship where her station on the route is now and FLEET_LEAD_MS on, in
   *  the scene - `{ n, band, ships }` - or null (in port, or the player off the sea). */
  function fleetList(now, p) {
    const f = fleetAt(now);
    const a = f && atSea(p) ? fleetPlace(f, now) : null, b = a && fleetPlace(f, now + FLEET_LEAD_MS);
    const sa = a && toScene(a.x, a.y), sb = sa && toScene(b.x, b.y);
    if (!sb) return null;
    const [ax, az] = sa, [bx, bz] = sb;
    const len = Math.hypot(bx - ax, bz - az) || 1, dx = (bx - ax) / len, dz = (bz - az) / len;
    const at = (x, z, st) => [x + dz * st[0] - dx * st[1], 0, z - dx * st[0] - dz * st[1]];   // a station: abeam, astern
    return { n: f.n, band: f.band, ships: f.ships.map((s) => ({ seed: s.seed, classId: s.classId, flag: s.flag, pos: at(ax, az, s.station), ahead: at(bx, bz, s.station), yaw: Math.atan2(dx, dz) })) };
  }
  /** THE SEA'S STEP, each exterior frame (`strikes` the lightning's strikes so far - world.js lightning.strikes): the fleet
   *  fed to the naval host (FLEET_FEED_MS apart); the storm's and the fleet's words as they come; the storm's lightning on
   *  the ship I sail. */
  function step(strikes = 0) {
    const now = clock(), p = deps.pixel?.();
    if (now - fedAt >= FLEET_FEED_MS) { fedAt = now; const list = fleetList(now, p); deps.naval?.()?.fleet?.(list, { sunk: !!list && down(list.n) }); }
    const cur = fleetAt(now);   // AUDIT SEA VENTURES D5: a sinking of mine the hub has not said, told it again (a socket shut when she went down)
    if (cur && !sunk.has(cur.n) && (mine.has(cur.n) || deps.ether?.fleetDone?.(cur.n)) && now - fkAt >= FLEET_TELL_MS && tellHub(cur.n)) fkAt = now;
    if (!atSea(p)) { inStorm = null; strikesSeen = null; return; }
    const s = stormAt(now), f = fleetAt(now);
    if (s && heardStorm !== s.n) { heardStorm = s.n; const e = stormEye(s, now); mid(t('sea.storm.gathers', 'An Aether storm gathers to the {way} ({band}).', { band: bandName(etherBandAt(e.x).id), way: wayTo(p, e) || etherWayWord('north') }), 5); }
    if (f && heardFleet !== f.n && !down(f.n)) { heardFleet = f.n; const q = fleetPlace(f, now); mid(t('sea.fleet.sails', 'A treasure fleet weighs anchor ({band}): the {ship} and her escorts, bound east. It lies to the {way}.', { band: bandName(f.band), ship: f.name, way: wayTo(p, q) || etherWayWord('north') }), 6); }
    const here = stormOver(p, now);
    if ((here?.n ?? null) !== inStorm) {
      if (here) say(t('sea.storm.enter', 'You sail into the Aether storm. Lightning seeks the masts, and wrack rides the swell.'), 5);
      else if (inStorm != null) say(t('sea.storm.leave', 'You sail out of the Aether storm.'), 4);
      inStorm = here?.n ?? null;
    }
    const n = Number(strikes) || 0;
    if (here && strikesSeen != null && n > strikesSeen) {
      const k = stormStrikeOf();
      if (k && deps.naval?.()?.stormStrike?.(k)) say(k.fire ? t('sea.storm.strikeFire', 'Lightning strikes your ship and sets her alight!') : t('sea.storm.strike', 'Lightning strikes your ship!'), 4);
    }
    strikesSeen = here ? n : null;
  }
  /** THE FLAGSHIP DOWN by my hand (the naval host's treasureFleet.ended): her purse, said - AUDIT SEA VENTURES D2: once a
   *  sailing, my ledger's (another's copy of her going down, a second word or a reload paid it every time), as a legend's
   *  is; the sailing scattered here and told to the hub (online, at a relay that reads it), which tells everyone. Answers
   *  the purse paid (none a second time - and so no piece: treasureFleet.js). */
  function fleetEnded(n, act) {
    const f = fleetOf(n);
    const first = !mine.has(f.n) && !deps.ether?.fleetDone?.(f.n);
    mine.add(f.n);
    deps.ether?.endFleet?.(f.n);
    if (tellHub(f.n)) fkAt = clock();   // a word that never left (the socket shut) is said at the next step it can be
    if (!first) return 0;
    deps.ether?.credit?.(f.purse);
    mid(act === 'board' ? t('sea.fleet.taken', 'The {ship} is taken! {gold} gold from her strongroom.', { ship: f.name, gold: f.purse }) : t('sea.fleet.sunk', 'The {ship} is sunk! {gold} gold floats up from her strongroom.', { ship: f.name, gold: f.purse }), 6);
    return f.purse;
  }
  /** THE HUB'S WORD of the fleets (`st` at hello, `fd` when a flagship goes down): the sailings scattered - one this sailing's
   *  that was not, said ("the fleet scatters") to a player at sea. Answers whether it was the fleet's word alone. */
  function hubWord(w) {
    if (w?.k !== 'st' && w?.k !== 'fd') return false;
    const now = clock(), cur = fleetAt(now), was = !!cur && down(cur.n);
    sunk.clear();   // the hub's word alone - mine kept (AUDIT SEA VENTURES D5: its hello put my own sinking out)
    for (const n of w.fleets ?? []) sunk.add(n);
    if (w.k === 'fd' && cur && !was && sunk.has(cur.n) && atSea()) mid(t('sea.fleet.scattered', 'The treasure fleet\'s flagship has gone down. The fleet scatters.'), 5);
    return w.k === 'fd';
  }
  /** THE CHART'S WORD of the events: the storm blowing (its eye now, its reach) and the fleet under way (its place, its
   *  heading, its route, its band, its flagship's name, whether it is scattered) - each null when there is none. */
  function eventsWord(now = clock()) {
    const s = stormAt(now), f = fleetAt(now);
    const eye = s ? stormEye(s, now) : null, at = f ? fleetPlace(f, now) : null;
    return {
      storm: s ? { n: s.n, x: eye.x, y: eye.y, r: s.r } : null,
      fleet: f ? { n: f.n, x: at.x, y: at.y, yaw: at.yaw, from: f.from, to: f.to, band: f.band, name: f.name, sunk: down(f.n) } : null,
    };
  }
  /** A FREEPORT HARBOURMASTER'S TALK of the events from the port's pixel: the fleet under way or the next to sail, and the
   *  storm blowing or the next to gather - each its way from here and its minutes. */
  function rumours(port) {
    const now = clock(), out = [], mins = (ms) => Math.max(1, Math.ceil(ms / 60_000));
    const f = fleetAt(now);
    if (f && !down(f.n)) out.push(t('sea.rumour.fleet', 'A treasure fleet is under way ({band}): the {ship} and her escorts, {way} of here and bound east. It makes port in {min} minutes.', { band: bandName(f.band), ship: f.name, way: wayTo(port && { x: port.px, y: port.py }, fleetPlace(f, now)) || etherWayWord('north'), min: mins(f.end - now) }));
    else { const g = nextFleet(now); out.push(t('sea.rumour.fleetNext', 'The next treasure fleet weighs anchor in {min} minutes ({band}), {way} of here.', { band: bandName(g.band), way: wayTo(port && { x: port.px, y: port.py }, g.from) || etherWayWord('north'), min: mins(g.start - now) })); }
    const s = stormAt(now);
    if (s) out.push(t('sea.rumour.storm', 'An Aether storm is blowing {way} of here. It blows itself out in {min} minutes.', { way: wayTo(port && { x: port.px, y: port.py }, stormEye(s, now)) || etherWayWord('north'), min: mins(s.end - now) }));
    else { const g = nextStorm(now); out.push(t('sea.rumour.stormNext', 'Sailors say an Aether storm will gather {way} of here in {min} minutes.', { way: wayTo(port && { x: port.px, y: port.py }, { x: g.x0, y: g.y0 }) || etherWayWord('north'), min: mins(g.start - now) })); }
    return out;
  }
  // ── SEA-BOUNTY ─────────────────────────────────────────────────────────────────────────────────────────────────────
  /** The realm character I play (HOST-SPLIT, SEA VENTURES: its own, unless the host gives it). */
  const character = deps.character ?? (() => characterIdOf(playerEntity));
  const bounty = createSeaBounty({ live, session: deps.session, checkpoint: deps.checkpoint, wallet: deps.wallet, character, region: deps.region, door: deps.bountyDoor, now: clock });
  // ── SHIP-PVP ───────────────────────────────────────────────────────────────────────────────────────────────────────
  const wrecks = createSeaWreckHost({ session: deps.session, checkpoint: deps.checkpoint, character, me: () => deps.cell?.()?.acct ?? null, naval: deps.naval, say: (text, s) => say(text, s) });
  const broadsides = createSeaBroadsides({
    live: () => live() && !!deps.cell?.()?.seaPvpOk && wildHere() && wildZoneKind() === ETHER_KIND,
    naval: deps.naval, send: (d, o) => deps.cell?.()?.sendWild?.(d, o) === true, me: () => deps.cell?.()?.id ?? null,
    stranger: (id) => !!deps.foe?.(id), name: (id) => (deps.name ? deps.name(id) : deps.cell?.()?.peers?.get?.(id)?.name) || '', receipt: (rc) => wrecks.receipt(rc),
    say: (text, s) => say(text, s), mid: (text, s) => mid(text, s),
  });
  let armed = null;   // the naval host the guns are attached to
  /** The open sea's guns' step, every online frame (world.js wildFrame - AUDIT SEA VENTURES E6A: the exterior's unpaused
   *  frames alone left a captain with a window open unsaid at her helm, and a wreck's carry unasked below): attached to
   *  the naval host that stands now, stepped; a wreck's carry come due. */
  function pvpStep() {
    try {   // the zone's frame goes on whatever the sea's guns do
      const nv = deps.naval?.() ?? null;
      if (nv && nv !== armed) { nv.pvp?.attach?.(broadsides); armed = nv; }
      broadsides.step();
      wrecks.frame();
    } catch (e) { console.warn('[sea] guns', e?.message ?? e); }
  }
  // ── SEA-SEASON ─────────────────────────────────────────────────────────────────────────────────────────────────────
  const season = createSeaSeason({ live, session: deps.session, character, door: deps.seasonDoor, now: clock });
  return { vaultsNow, vaultHere, openSeaAt, chartWord: (now) => ({ ...chartWord(now), ...eventsWord() }), crowLine, stormWord, stormTurned, wrackSites, office: () => ({ wanted: bounty.office(), season: season.office() }), wref: (g, room) => broadsides.hear(g, room), gather, step, guns: pvpStep, fleetEnded, hubWord, rumours, fleetList: (now = clock()) => fleetList(now, deps.pixel?.()) };
}
