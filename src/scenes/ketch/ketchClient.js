// @ts-check
// KETCH (2026-10-24, the owner: "A new quest line and world event that takes you to the skies with proper lore. A proper
// dwarven airship flies in once a week over the skies of daggerfall, and you, along with other players venture into it
// in a raid like format ... implement a new mechanic where players have to pick up an item and bank it to progress", then
// "Make the dwarven event 8 player"; bible/11-Multiplayer/Sky-Ketch.md): THE SKY-KETCH ON THIS SCREEN - the world host's one
// piece for it (HOST-SPLIT: scenes/world.js constructs it once and reads its seams; the dungeon host's half is
// scenes/ketch/ketchDeckHost.js). Online alone - the Ketch is the relay's.
//
//   THE VOYAGE'S WORDS: the Ketch sighted, arrived, weighing anchor and gone said in the chat once each (the clock's -
//     net/ketch/ketchLaw.js), and her line on the Timers row and her mark on the held map.
//   THE SKY (scenes/ketch/ketchSky.js): she drawn where the clock has her, her anchor-lift let down to the fields outside
//     Daggerfall's east wall, and the ride up - THE BOARDING: the crew's ship is its captain's (my party's leader, or me
//     alone), its room `kt:<voyage>.<captain's digest>` (net/instanceRoom.js instanceOwnerOf); the mode machine stands me
//     on the made level (scenes/worldModes.js enterKetch) and the room takes me or refuses me.
//   ABOARD: the room's words folded (net/ketch/ketchLink.js), the fights drawn and judged on my feet
//     (scenes/ketch/ketchFight.js), my `in` to the bridge's fight and my body's word, THE CELLS - taken from a cradle, carried
//     (slowed - player/motor.js registerFootSpeedMod - the weapon put up: readying it lets the cell go), set in the
//     engine's sockets or a false resonator, knocked from my hands by any blow that meets me - the bosun's line ridden,
//     the ways down (the anchor-lift on the Anchor Deck, the stern lift in the cabin), the nets' cast-back and its cost,
//     A DEATH A FALL (the death save: out of the sky to the fields under her lift, the lift there to ride again while she
//     keeps station), the voyage's end, the room's refusal - and the HUD (ui/ketch/ketchHud.js).
//   THE HOLD: every `y1` the room hands me kept on the device and carried to the account service
//     (net/ketch/ketchClaims.js); a share it pays waits in the Ketchmaster's chest while I stand aboard (opened, it spills
//     across the cabin floor - the Hour's spoils pool), and goes into the pack if I leave without opening it.
//
// Not a DFU member. Ledger A (KETCH).
import { KT_STAGE, KT_TEXT, ketchVoyageAt, ketchVoyageOf, ketchBoards, ketchRoomKey } from '../../net/ketch/ketchLaw.js';
import { t } from '../../systems/textManager.js';
import { KT_WORDS, KT_REFUSE_WORDS, ketchRefusal, ketchSkyPhase, ketchWhenLine } from '../../systems/ketch/ketchWords.js';
import {
  KT_CRADLES, KT_BRIDGE_CRADLES, KT_SOCKETS, KT_RESONATORS, KT_HOLD, KT_BRIDGE, KT_LINE, KT_MAIN_TOP, KT_ANCHOR_LIFT, KT_STERN_LIFT, KT_VAULT,
  KT_REACH, KT_LINE_LAND, deckToDungeon, dungeonToDeck, deckZoneAt,
} from '../../net/ketch/ketchDeck.js';
import { KT_BRIDGE_CRADLE0, KT_RESONATOR0, KT_CARRY_PACE } from '../../net/ketch/ketchBrain.js';
import { createKetchLink } from '../../net/ketch/ketchLink.js';
import { createKetchClaims } from '../../net/ketch/ketchClaims.js';
import { instanceOwnerOf } from '../../net/instanceRoom.js';
import { bodySayer } from '../../net/bossBody.js';
import { createKetchFight } from './ketchFight.js';
import { createKetchSky, ketchSkyPose } from './ketchSky.js';
import { bosunLineAt } from '../../world/ketch/ketchModel.js';
import { ketchSpoilsOf, KT_SPOILS_TEXT, KT_SPOILS_KEYS, KT_SPOILS_RECORDS_MAX, KT_SPOILS_GATHERED, ketchConstructPellets, ketchPelletsDue, KT_PELLETS_KEY } from '../../systems/ketch/ketchSpoils.js';
import { createPellets } from '../../systems/thunderlock.js';   // KETCH-PELLETS: what her constructs drop
import { createSpoilsPool, recoverSpoils } from '../spoilsPool.js';
import { createKetchShares, ketchChestMouth } from './ketchShares.js';
import { addItem, addGoldPieces } from '../../systems/inventory.js';
import { itemIconColor32 } from '../../ui/item/itemIconColor32.js';
import { lootPileName } from '../../systems/worldTooltips.js';
import { characterIdOf } from '../../systems/characterId.js';
import { onSlotSaved, onSlotLoaded, enumerateSaves } from '../../systems/save/saveSlots.js';
import { noteAct } from '../../systems/questlines/qlActs.js';
import { registerPlayerDeathSave, hurtPlayer, registerPlayerDamageMod, registerPlayerHold } from '../../characters/playerEntity.js';   // AUDIT WORLD-EVENTS L1-4: a body lying down takes no blow and holds still
import { KT_DOWN_MS, KT_REZ_PCT } from '../../net/ketch/ketchBrain.js';   // AUDIT WORLD-EVENTS L1-4: the ship's window for a raise, and the health it stands the raised at
import { flashPlayerDamage } from '../../ui/damageFlash.js';
import { longitudeLatitudeToMapPixel } from '../../formats/mapsFile.js';
import { spawnedLocationCentreLocal } from '../../world/spawnedDungeons.js';
import { ARENA_REGION, ARENA_LOCATION } from '../../world/arena/arenaCity.js';   // Daggerfall's own row (the arena's city)
import { registerFootSpeedMod } from '../../player/motor.js';
import { tooFarAwayText } from '../../player/activate.js';
import { ketchHudModel, wardenBarModel, drawKetchHud } from '../../ui/ketch/ketchHud.js';
import { drawGateBossBar } from '../../ui/gate/gateBossBar.js';
import { KT_RING_R } from '../../ui/ketch/ketchMapMark.js';

/** A carrier's pace on foot (a share of its own): the cell is heavy, and held in both hands. */
export { KT_CARRY_PACE };
/** The nets' cast-back costs this share of the body's health (the Steps' own law - net/superDungeon's SD_CAST_BACK_LOSS). */
export const KT_CAST_BACK_LOSS = 0.15;
/** A fall wakes the body in the fields at this share of its health. */
export const KT_FALL_WAKE = 0.25;
/** The bosun's line's ride (m/s along it), and where it sets a rider down - the gangway's head. */
export const KT_LINE_SPEED = 11;
/** A readied weapon lets the cell go; the hands are given back this long before the room's word is waited on again (ms). */
export const KT_LET_GO_MS = 1500;
/** The room's refusals a ship walks me out on (its socket's terminal close), and how long after the step aboard a refusal
 *  is still the door's (ms). */
export const KT_DOOR_MS = 20_000;
/** The words this file says - each read through the text core when it is said (L10N4). */
export const KT_CLIENT_TEXT = Object.freeze({
  get signIn() { return t('ketch.client.signIn', 'Sign in to ride the anchor-lift.'); },
  get older() { return t('ketch.client.older', 'Your game is out of date. Reload or update to board the Ketch.'); },
  get letGo() { return t('ketch.client.letGo', 'You drop the aether cell.'); },
  get handsFull() { return t('ketch.client.handsFull', 'Your hands are full.'); },
  get chest() { return t('ketch.client.chest', 'The Ketchmaster\'s chest'); },
  get chestSub() { return t('ketch.client.chestSub', 'Open your share'); },
  get chestEmpty() { return t('ketch.client.chestEmpty', 'The Ketchmaster\'s chest holds nothing of yours yet.'); },
  get cell() { return t('ketch.client.cell', 'An aether cell'); },
  get cellTake() { return t('ketch.client.cellTake', 'Take it up'); },
  get cellLoose() { return t('ketch.client.cellLoose', 'A dropped aether cell'); },
  get socket() { return t('ketch.client.socket', 'An engine socket'); },
  get socketSet() { return t('ketch.client.socketSet', 'Set your cell'); },
  get resonator() { return t('ketch.client.resonator', 'A false resonator'); },
  get line() { return t('ketch.client.line', 'The bosun\'s line'); },
  get lineSub() { return t('ketch.client.lineSub', 'Ride it to the bridge'); },
  get down() { return t('ketch.client.down', 'The anchor-lift'); },
  get stern() { return t('ketch.client.stern', 'The stern lift'); },
  get downSub() { return t('ketch.client.downSub', 'Ride it down'); },
  get away() { return t('ketch.client.away', 'The Ketch has gone. You are back in the fields outside Daggerfall.'); },
});
/** MY SHIP THIS VOYAGE (AUDIT KETCH L1-6 - after the party's lead passed on, a member riding back up boarded the new
 *  leader's empty ship): the room's `st` naming me in its crew keeps {n, a, o, p} under KT_SHIP_KEY on the device - `p`
 *  the party I was in when it was kept (its id, null alone). */
export const KT_SHIP_KEY = 'ketch.myShip';
/** The ship a `st` frame `w` from the ship under me (`at` - its {n, owner}) says I am of, in party `party` (its id, or
 *  null): {n, a, o, p}, or null. */
export const ketchShipKept = (w, mine, at, party = null) => (w?.k === 'st' && mine && at && w.n === at.n && Array.isArray(w.cr) && w.cr.some((c) => c?.[0] === mine) ? { n: at.n, a: mine, o: at.owner, p: party ?? null } : null);
/** THE SHIP I RIDE UP TO: the one I was taken into this voyage (`kept`) while I stand in the party I was in then (`party`
 *  - AUDIT SHIP 1: a ride up alone kept my own ship, and a party joined after it never took me to its leader's), else my
 *  party leader's, else my own - `{owner}` kept, else `{captain}` to digest. */
export const ketchShipChoice = (n, mine, leader, kept, party = null) => (kept && kept.n === n && kept.a === mine && typeof kept.o === 'string' && kept.o && (kept.p ?? null) === (party ?? null) ? { owner: kept.o } : { captain: leader ?? mine });
/** THE PRESS'S REACH (AUDIT KETCH L3-5 - a press was let through from further than the room takes it, and the room said
 *  nothing): a cell's press goes only from where the room takes it - my feet within KT_PRESS_REACH of its spot, the room's
 *  own KT_REACH + 0.6 (net/ketch/ketchBrain.js voyageWord) less a step for the pose it last heard. */
export const KT_PRESS_REACH = KT_REACH + 0.4;
/** A press's spot on the deck ([x, z]) - a cradle's, a lying cell's (in `cl`), a socket's, a resonator's - or null. */
export function ketchPressSpot(key, cl) {
  const k = String(key), n = Number(k.split(':')[2]);
  if (k.startsWith('kt:cr:')) return KT_CRADLES[n] ?? null;
  if (k.startsWith('kt:bc:')) return KT_BRIDGE_CRADLES[n] ?? null;
  if (k.startsWith('kt:sk:')) return KT_SOCKETS[n] ?? null;
  if (k.startsWith('kt:rs:')) return KT_RESONATORS[n] ?? null;
  if (k.startsWith('kt:lo:')) { const l = (cl?.lo ?? []).find((q) => q[0] === n); return l ? [l[1], l[3]] : null; }
  return null;
}
/** Is a press from `feet` (the deck's frame) further than the room takes it? */
export const ketchPressFar = (key, cl, feet) => { const s = ketchPressSpot(key, cl); return !!s && !!feet && Math.hypot(feet[0] - s[0], feet[2] - s[1]) > KT_PRESS_REACH; };
/**
 * THE HANDS FULL, a step a frame: a carrier's readied weapon put up (`sheathe`), said once (`handsFull`); readied again
 * after that, the cell let go - said (`letGo`) only when the word left (AUDIT KETCH L3-6: said when the drop never went,
 * the cell still in the room's hands), else the weapon put up again and the drop asked next frame. Pure.
 * @param {{ carrying: boolean, sheathed: (boolean|undefined), forced: boolean, letGoAt: number }} st @param {number} t
 * @param {() => boolean} sendDrop @returns {{ forced: boolean, letGoAt?: number, sheathe?: boolean, say?: ('handsFull'|'letGo'|null) }}
 */
export function ketchCarryStep(st, t, sendDrop) {
  if (!st.carrying) return { forced: false };
  if (t - st.letGoAt < KT_LET_GO_MS) return { forced: st.forced };   // the hands given back while the room hears the cell let go
  if (st.forced && st.sheathed === false) return sendDrop() ? { forced: false, letGoAt: t, say: 'letGo' } : { forced: true, sheathe: true };
  if (!st.sheathed) return { forced: true, sheathe: true, say: st.forced ? null : 'handsFull' };
  return { forced: true };
}
/** A SHIP NEVER HEARD (AUDIT KETCH L3-11 - a busy door closes its socket to be tried again, not for good, and left me on
 *  an empty deck with nothing said): no word of her (`V`, the link's state) KT_DOOR_MS after the step aboard - walked
 *  down, the door's busy word said. */
export const ketchShipUnheard = (V, sinceMs) => !(V?.n >= 0) && sinceMs > KT_DOOR_MS;
const NONE = Object.freeze([]);
const BOX = 0.55;
/** Daggerfall's map pixel (formats/mapsFile.js longitudeLatitudeToMapPixel of its own row - pinned). */
export const KT_CITY_PX = Object.freeze({ x: 207, y: 213 });
/** An activation target about a deck point: a box `h` tall over (x, y, z) - the loot piles' shape (dungeonContext.js). */
const target = (key, x, y, z, h = 1.2, half = BOX, reach = KT_REACH + 0.4) => { const p = deckToDungeon(x, y, z); return { key, aabb: { min: [p[0] - half, p[1], p[2] - half], max: [p[0] + half, p[1] + h, p[2] + half] }, distance: reach + 2, reach }; };

/**
 * @param {{
 *   renderer?: any, gl?: any, getTexture?: any, uploadRecordFrame?: any, audio?: any,
 *   online: () => any, modes: () => any, social?: () => any, account: { me: () => (string|null), claim: (r: string, cid: string) => Promise<any> },
 *   entity: any, player: any, cam: any, now: () => number,
 *   maps?: any, state?: any, heightAt?: (x: number, z: number) => number, collider?: () => any,
 *   feetOutside?: () => (number[]|null), site?: () => any, peers?: () => Array<{ sub: string, pos: number[] }>,
 *   say?: (text: string) => void, mid?: (text: string) => void, save?: (e: any, el: string) => number,
 *   store?: any, hudHidden?: () => boolean, spent?: (n: number) => boolean, changed?: () => void,
 * }} deps
 *   `online` the session (net/online.js - sendKetch, ktOk); `modes` the mode machine (enterKetch, ktLeave, ktPlace, ktShip,
 *   dungeonCtx); `social` the hub's picture (its party's leader); `account` net/accountClient.js accountKetch; `now` the
 *   relay's clock; `maps` the world's map file and `state` its streaming frame (Daggerfall's centre in the scene - its
 *   own row, its pixel's place), `heightAt` the terrain under a scene point; `feetOutside` my feet in the open world, or
 *   null; `site` the climate and region the made level is laid under; `peers` my crew's bodies where this screen draws
 *   them; `say` a chat line, `mid` a line over the screen; `save` my throw against an element; `store` the device's
 *   (get/set) - the Ketchmaster's hold's own pool's (scenes/spoilsPool.js, made here); `spent` a voyage's share given, said
 *   to the hub (net/online.js sendKetchSpent - true when it went); `changed` a save asked for
 */
export function createKetchClient(deps) {
  const { online, modes, account, entity, player, cam, now } = deps;
  const say = deps.say ?? (() => {}), mid = deps.mid ?? say, social = deps.social ?? (() => null), peers = deps.peers ?? (() => NONE);
  const me = () => account.me?.() ?? null;
  const ship = () => modes()?.ktShip?.() ?? null;
  const onShip = () => !!ship();
  const feetDeck = () => { if (!onShip()) return null; const f = player.feetAt(); return dungeonToDeck(f[0], f[1], f[2]); };
  const link = createKetchLink({ now, say: (t) => mid(t), me });
  let shipMem = null;
  const keptShip = () => { if (shipMem) return shipMem; try { return deps.store?.get?.(KT_SHIP_KEY) ?? null; } catch { return null; } };
  const keepShip = (m) => { shipMem = m; try { deps.store?.set?.(KT_SHIP_KEY, m); } catch { /* memory holds it */ } };
  // THE KETCHMASTER'S HOLD'S OWN POOL (AUDIT KETCH L2-3 - the Ketch threw into the Hour's, its words and its spent marks
  // the Hour's): its own keys, its words, no floor's leftovers promised to the mailbox (L2-4 - the service keeps no kill of
  // a ship's), its spent word to the hub (`spent`, L1-2); the shares it is handed kept on the device until it holds them
  const who = () => characterIdOf(entity);
  /** the ship's collider's ray (the spoils' flight off the cabin floor), and a piece into my pack */
  const dungeonRay = (from, dir, len) => { const c = modes()?.dungeonCtx?.collider; const h = c?.raycastHit ? c.raycastHit(from, dir, len) : { dist: c?.raycast?.(from, dir, len) ?? Infinity, normal: null }; return Number.isFinite(h?.dist) ? h : null; };
  const takeSpoil = (p) => { if (p.kind === 'gold') addGoldPieces(entity, p.gold); else if (p.item) addItem(entity.items, p.item); };
  const spoils = createSpoilsPool({
    renderer: deps.renderer, gl: deps.gl, getTexture: deps.getTexture, uploadRecordFrame: deps.uploadRecordFrame, audio: deps.audio,
    ray: dungeonRay, now, take: takeSpoil, say: (text) => (text === KT_SPOILS_GATHERED ? say(KT_SPOILS_TEXT.gathered) : mid(text)),
    store: deps.store ?? null, who, me, iconOf: (item) => itemIconColor32(item, { identity: entity }), itemName: (item) => lootPileName([item]),
    onSpent: (day) => { const k = ketchSpoilsOf(day); return !k || deps.spent?.(k.d) === true; },
    keys: KT_SPOILS_KEYS, recordsMax: KT_SPOILS_RECORDS_MAX, gathered: KT_SPOILS_GATHERED,
  });
  onSlotSaved((id) => { try { spoils.saved(id); } catch (e) { console.warn('[kt] spoils', e?.message ?? e); } });
  onSlotLoaded((id) => { try { spoils.loaded(id); } catch (e) { console.warn('[kt] spoils', e?.message ?? e); } });
  const shares = createKetchShares({ store: deps.store ?? null, pool: spoils, level: () => entity.level ?? 1, me, aboard: () => onShip(), say: (t) => mid(t), changed: () => deps.changed?.() });
  const claims = createKetchClaims({
    claim: (r, cid) => account.claim(r, cid), store: deps.store ? { get: (k) => deps.store.get(k), set: (k, v) => deps.store.set(k, v) } : null,
    nowS: () => Math.floor(now() / 1000), say, me, paid: (c) => paid(c),
  });
  const fight = createKetchFight({
    renderer: deps.renderer, gl: deps.gl, getTexture: deps.getTexture, uploadRecordFrame: deps.uploadRecordFrame, audio: deps.audio, link, now,
    cam: () => cam.pos, feet: () => (onShip() ? player.feetAt() : null), grounded: () => !!player.grounded, player: () => entity,
    save: deps.save, strike: (d, how) => modes()?.dungeonCtx?.strikePlayer?.(d, how), say: (t) => mid(t),
    sendHit: (h) => !!online()?.sendKetch?.('hit', h), onStruck: () => struck(), fell: (kind, id, at) => constructFell(kind, id, at),
  });
  // KETCH-PELLETS (2026-10-25, the owner: "We need more aquireable sources of deeamer pellets"): A CONSTRUCT DOWNED LAYS
  // ITS PELLETS ON HER DECK where it fell - on this screen, for me (each hand aboard its own pile, as the share is): once a
  // body (its id, the ship's), a voyage's capped (KT_CONSTRUCT_PELLETS_MAX), on the dungeon's own dropped loot
  // (dungeonContext.js layRemains); with no deck to lay them on, into the pack. AUDIT KETCH II L3-1: the cap her voyage's
  // (`ship().n`), kept on the device (KT_PELLETS_KEY) - a reload or a second crew's ship that voyage tallied on, never afresh -
  // and a body once a ship (its room's key in its own); L3-2: the bosses pay their own (ketchPelletsDue)
  const pelletDrops = { n: -1, ids: new Set(), given: 0 };
  function constructFell(kind, id, at) {
    const sh = ship();
    if (!sh) return;
    if (pelletDrops.n !== sh.n) {
      let kept = null;
      try { kept = deps.store?.get?.(KT_PELLETS_KEY) ?? null; } catch { /* none kept */ }
      pelletDrops.n = sh.n; pelletDrops.ids.clear();
      pelletDrops.given = kept?.n === sh.n && Number.isFinite(kept.given) ? kept.given : 0;
    }
    const key = `${sh.key}:${kind}:${id}`;
    if (pelletDrops.ids.has(key)) return;
    pelletDrops.ids.add(key);
    const due = ketchPelletsDue(kind, ketchConstructPellets(kind), pelletDrops.given), n = due.n;
    if (due.given !== pelletDrops.given) { pelletDrops.given = due.given; try { deps.store?.set?.(KT_PELLETS_KEY, { n: sh.n, given: due.given }); } catch { /* memory holds it */ } }
    if (!(n > 0)) return;
    const shot = createPellets(n);
    try { if (modes()?.dungeonCtx?.layRemains?.([shot], [at[0], at[1], at[2]])) return; } catch (e) { console.warn('[kt] pellets', e?.message ?? e); }
    entity.items?.push?.(shot);
  }
  // DAGGERFALL IN THE SCENE: its own row read once (formats/mapsFile.js), its centre in its pixel (the spawns' law -
  // world/spawnedDungeons.js spawnedLocationCentreLocal), its pixel where the streaming frame stands it now
  let cityRow;
  const _t = [0, 0, 0];
  const cityRead = () => { if (cityRow === undefined) { try { const loc = deps.maps?.getLocation?.(ARENA_REGION, ARENA_LOCATION) ?? null; const px = loc ? longitudeLatitudeToMapPixel(loc.mapTableData.longitude, loc.mapTableData.latitude) : null; cityRow = loc && px ? { px, local: spawnedLocationCentreLocal(loc) } : null; } catch { cityRow = null; } } return cityRow; };
  /** @returns {[number, number]|null} */
  const city = () => { const c = cityRead(); if (!c || !deps.state?.pixelTranslation) return null; const t = deps.state.pixelTranslation(c.px.x, c.px.y, _t); return [t[0] + c.local[0], t[2] + c.local[1]]; };
  const frameY = () => { const c = cityRead(); return c && deps.state?.pixelTranslation ? deps.state.pixelTranslation(c.px.x, c.px.y, _t)[1] : 0; };
  const sky = createKetchSky({
    renderer: deps.renderer, collider: deps.collider, city, groundAt: (x, z) => deps.heightAt?.(x, z) ?? NaN, frameY, now,
    feet: () => deps.feetOutside?.() ?? null, say: (t) => mid(t), onBoard: () => { void board(); }, mayBoard: () => !boarding && !onShip(),
  });
  const sayBody = bodySayer((v) => !!online()?.sendKetch?.('vt', { v }));
  // ── the voyage's words, once each ──
  const said = new Set();
  let sawPhase = null;
  function voyageWords(t) {
    const v = ketchVoyageAt(t), key = `${v.n}:${v.phase}`;
    if (v.phase === 'away') { if (sawPhase && sawPhase.n === v.n - 1 && !said.has(`${v.n - 1}:gone`)) { said.add(`${v.n - 1}:gone`); say(KT_WORDS.departed); } sawPhase = null; return v; }
    if (!said.has(key)) {
      said.add(key);
      say(v.phase === 'sighted' ? KT_WORDS.sighted : v.phase === 'docked' ? KT_WORDS.arrived : KT_WORDS.departing);
    }
    sawPhase = { n: v.n, phase: v.phase };
    return v;
  }
  // ── boarding ──
  let boarding = false, boardedAt = -Infinity, wasOnShip = false, falling = null, wake = null;
  async function board() {
    if (boarding || onShip()) return false;
    const o = online(), t = now(), v = ketchVoyageAt(t);
    if (!o || o.status !== 'open') { mid(KT_REFUSE_WORDS.offline); return false; }
    if (!o.ktOk) { mid(KT_CLIENT_TEXT.older); return false; }
    if (v.phase !== 'docked' || !ketchBoards(v.n, t)) { mid(v.phase === 'departing' ? KT_REFUSE_WORDS.closed : KT_REFUSE_WORDS.away); return false; }
    const mine = me();
    if (!mine) { mid(KT_CLIENT_TEXT.signIn); return false; }
    if (!(entity.health > 0)) return false;
    boarding = true;
    try {
      const pick = ketchShipChoice(v.n, mine, social()?.party?.leader ?? null, keptShip(), social()?.party?.id ?? null);
      const owner = pick.owner ?? await instanceOwnerOf(pick.captain);
      if (!ketchRoomKey(v.n, owner)) { mid(KT_REFUSE_WORDS.busy); return false; }
      mid(KT_WORDS.boarding);
      const ok = !!(await modes()?.enterKetch?.({ n: v.n, owner, site: deps.site?.() ?? null }));
      if (ok) { boardedAt = Date.now(); noteAct('ketch-boarded'); }
      return ok;
    } catch (e) { console.warn('[kt] boarding', e?.message ?? e); mid(KT_REFUSE_WORDS.busy); return false; } finally { boarding = false; }
  }
  /** Down from the ship (the way down, the voyage's end, a refusal): out at the next frame, to where I boarded. */
  function leave(text) {
    if (!onShip()) return false;
    if (!modes()?.ktLeave?.()) return false;
    if (text) mid(text);
    sky.hold();
    return true;
  }
  /** AUDIT WORLD-EVENTS L1-4 - RAISE BEFORE THE FALL (net/ketch/ketchBrain.js ketchRaise): a death aboard with a crewmate on
   *  the ship lies DOWN where it fell for KT_DOWN_MS - the body held there, dying on every screen (net/online.js `poseDown`),
   *  no blow reaching it - for a crewmate's Resurrect (the room's `rez`); past it, THE FALL as ever. Answers whether it lay. */
  let down = null;
  function lieDown(why) {
    if (down) return true;
    const lp = online()?._pose ?? null, f = player.feetAt?.() ?? null;   // my pose's frame (the world host's `_deadMark`'s), and my feet to hold
    if (!onShip() || falling || !lp || !Number.isFinite(lp.x) || !Array.isArray(f) || !((online()?.peers?.size ?? 0) > 0)) return false;
    down = { why, until: Date.now() + KT_DOWN_MS, spot: [lp.x, lp.y ?? 0, lp.z], hold: [...f] };
    if (link.carrying()) online()?.sendKetch?.('drop');
    entity.health = Math.max(1, Math.min(entity.health, 1));
    mid(t('kt.down', 'You are down. A crewmate can raise you within {s} seconds.', { s: KT_DOWN_MS / 1000 }));
    return true;
  }
  function downFrame() {
    if (!down) return;
    if (Date.now() >= down.until) { const why = down.why; down = null; fall(why); return; }
    modes()?.ktPlace?.(down.hold, null);
  }
  registerPlayerDamageMod('kt-down', (_e, d) => (down ? 0 : d));
  registerPlayerHold('kt-down', () => !!down);
  /** A FALL: the death save's, the relay's count's - out of the sky to the fields, woken at KT_FALL_WAKE of my health. */
  function fall(why) {
    if (!onShip() || falling) return;
    falling = { why, at: Date.now() };
    if (link.carrying()) online()?.sendKetch?.('drop');
    leave(null);
  }
  // ── the cells ──
  let letGoAt = -Infinity, forced = false;
  const weapon = () => modes()?.dungeonCtx?.weaponRig?.()?.playerWeapon ?? null;
  function struck() { if (link.carrying()) online()?.sendKetch?.('hurt'); }
  function carryFrame(t) {
    const pw = weapon();
    const s = ketchCarryStep({ carrying: onShip() && link.carrying() && !!pw, sheathed: pw?.sheathed, forced, letGoAt }, t, () => !!online()?.sendKetch?.('drop'));
    forced = s.forced;
    if (s.letGoAt != null) letGoAt = s.letGoAt;
    if (s.sheathe && pw) pw.sheathed = true;
    if (s.say) mid(KT_CLIENT_TEXT[s.say]);
  }
  registerFootSpeedMod('kt-carry', () => (onShip() && link.carrying() ? KT_CARRY_PACE : 1));
  // ── the bosun's line ──
  let ride = null;
  function rideFrame() {
    if (!ride) return;
    if (!onShip()) { ride = null; return; }
    const u = Math.min(1, (performance.now() - ride.t0) / ride.ms), p = bosunLineAt(u);
    const at = u >= 1 ? deckToDungeon(KT_LINE_LAND.x, 0.1, KT_LINE_LAND.z) : deckToDungeon(p[0], p[1] - 1.9, p[2]);
    modes()?.ktPlace?.(at, u >= 1 ? KT_LINE_LAND.yaw : null);   // past the gust, facing the bridge (AUDIT KETCH L3-7, L4-6)
    if (u >= 1) ride = null;
  }
  function takeLine() {
    const a = bosunLineAt(0), b = bosunLineAt(1), len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    ride = { t0: performance.now(), ms: (len / KT_LINE_SPEED) * 1000 };
    if (link.carrying()) online()?.sendKetch?.('drop');
    mid(KT_WORDS.lineTaken);
  }
  // ── the hold ──
  function paid(c) {
    if (c && Number.isSafeInteger(c.c)) shares.paid(c);
  }
  function openChest() {
    const at = ketchChestMouth(), f = player.feetAt();   // KETCH-FIX: out of the chest's mouth, never its solid middle
    if (!shares.chest(at, Math.atan2(f[0] - at[0], f[2] - at[2]))) mid(KT_CLIENT_TEXT.chestEmpty);
  }
  // ── the presses aboard ──
  const _targets = [];
  function targets() {
    _targets.length = 0;
    if (!onShip()) return NONE;
    const V = link.state(), cl = V.cl, ws = V.ws, carrying = link.carrying();
    if (cl && !carrying) {
      if (V.sg === KT_STAGE.engine) cl.cr.forEach((c, j) => { if (c === 1) _targets.push(target(`kt:cr:${j}`, KT_CRADLES[j][0], KT_HOLD.y, KT_CRADLES[j][1])); });
      if (V.sg === KT_STAGE.bridge && ws?.ph === 2 && ws.ward) cl.br.forEach((c, j) => { if (c === 1) _targets.push(target(`kt:bc:${j}`, KT_BRIDGE_CRADLES[j][0], KT_BRIDGE.y, KT_BRIDGE_CRADLES[j][1])); });
      for (const l of cl.lo ?? NONE) _targets.push(target(`kt:lo:${l[0]}`, l[1], l[2], l[3], 1.1));
    }
    if (cl && carrying) {
      if (V.sg === KT_STAGE.engine) cl.sk.forEach((v, j) => { if (v === 0) _targets.push(target(`kt:sk:${j}`, KT_SOCKETS[j][0], KT_HOLD.y, KT_SOCKETS[j][1], 1.6)); });
      if (ws?.ph === 2 && ws.ward) (ws.rs ?? NONE).forEach((v, k) => { if (v === 0) _targets.push(target(`kt:rs:${k}`, KT_RESONATORS[k][0], KT_BRIDGE.y, KT_RESONATORS[k][1], 4.2, 1.2)); });
    }
    if (V.sg >= KT_STAGE.bridge) _targets.push(target('kt:line', KT_LINE.x, KT_MAIN_TOP.y, KT_LINE.z, 3.4, 0.5));
    _targets.push(target('kt:down', KT_ANCHOR_LIFT.x, 0, KT_ANCHOR_LIFT.z, 3, KT_ANCHOR_LIFT.r - 0.4));
    if (V.sg >= KT_STAGE.vault) {
      _targets.push(target('kt:stern', KT_STERN_LIFT.x, 0, KT_STERN_LIFT.z, 3, KT_STERN_LIFT.r - 0.4));
      _targets.push(target('kt:vault', KT_VAULT.x, 0, KT_VAULT.z, 1.3, 0.9));
    }
    return _targets;
  }
  function name(key) {
    const k = String(key);
    if (k.startsWith('kt:cr:') || k.startsWith('kt:bc:')) return { title: KT_CLIENT_TEXT.cell, subs: [KT_CLIENT_TEXT.cellTake] };
    if (k.startsWith('kt:lo:')) return { title: KT_CLIENT_TEXT.cellLoose, subs: [KT_CLIENT_TEXT.cellTake] };
    if (k.startsWith('kt:sk:')) return { title: KT_CLIENT_TEXT.socket, subs: [KT_CLIENT_TEXT.socketSet] };
    if (k.startsWith('kt:rs:')) return { title: KT_CLIENT_TEXT.resonator, subs: [KT_CLIENT_TEXT.socketSet] };
    if (k === 'kt:line') return { title: KT_CLIENT_TEXT.line, subs: [KT_CLIENT_TEXT.lineSub] };
    if (k === 'kt:down') return { title: KT_CLIENT_TEXT.down, subs: [KT_CLIENT_TEXT.downSub] };
    if (k === 'kt:stern') return { title: KT_CLIENT_TEXT.stern, subs: [KT_CLIENT_TEXT.downSub] };
    if (k === 'kt:vault') { const m = me(); return { title: KT_CLIENT_TEXT.chest, subs: shares.owed().some((e) => !m || e.s === m) ? [KT_CLIENT_TEXT.chestSub] : [] }; }
    return null;
  }
  /** A press aboard (the dungeon host's activation, `kt:` keys). */
  function press(key) {
    const k = String(key), o = online(), n = Number(k.split(':')[2]);
    if (!onShip() || !(entity.health > 0)) return false;
    if (ketchPressFar(k, link.state().cl, feetDeck())) { mid(tooFarAwayText()); return true; }
    if (k.startsWith('kt:cr:')) return !!o?.sendKetch?.('pick', { c: n });
    if (k.startsWith('kt:bc:')) return !!o?.sendKetch?.('pick', { c: KT_BRIDGE_CRADLE0 + n });
    if (k.startsWith('kt:lo:')) return !!o?.sendKetch?.('pick', { l: n });
    if (k.startsWith('kt:sk:')) return !!o?.sendKetch?.('bank', { s: n });
    if (k.startsWith('kt:rs:')) return !!o?.sendKetch?.('bank', { s: KT_RESONATOR0 + n });
    if (k === 'kt:line') { if (link.state().sg >= KT_STAGE.bridge) takeLine(); else mid(KT_WORDS.bridgeBarred); return true; }
    if (k === 'kt:down' || k === 'kt:stern') return leave(KT_WORDS.lowered);
    if (k === 'kt:vault') { openChest(); return true; }
    return false;
  }
  // ── one frame ──
  let hudUp = false, barUp = false;
  function aboardFrame(t) {
    const V = link.state(), f = feetDeck(), zone = f ? deckZoneAt(f[0], f[1], f[2]) : null, o = online();
    // the room walks me out: its socket's terminal close (a refusal at the door, the voyage gone)
    if (o?.terminal && o.status !== 'open' && Date.now() - boardedAt > 1500) {
      if (o.error === KT_TEXT.refuse.crew) keepShip(null);   // that ship's crew no longer mine: my party's next
      leave(o.error ? ketchRefusal(o.error) : KT_CLIENT_TEXT.away); return;
    }
    if (ketchShipUnheard(V, Date.now() - boardedAt)) { leave(KT_REFUSE_WORDS.busy); return; }
    const sh = ship();
    if (sh && t >= ketchVoyageOf(sh.n).endAt) { leave(KT_CLIENT_TEXT.away); return; }
    // my `in` to the bridge's fight, my body's word
    if (zone === 'bridge' && entity.health > 0 && link.inDue(t) && o?.sendKetch?.('in', { lv: Math.max(1, entity.level | 0) })) link.sentIn(t);
    // AUDIT KETCH II L2-3: my body's word the whole voyage - the room counts every blow on me aboard, and heard my health
    // in the Warden's fight alone, so a heal before the bridge never reached its count
    if (entity.health > 0 && entity.maxHealth > 0) sayBody(entity.health / entity.maxHealth, performance.now());
    try { fight.frame(); } catch (e) { console.warn('[kt] fight', e?.message ?? e); }
    carryFrame(t);
    rideFrame();
    try { spoils.frame(); } catch (e) { console.warn('[kt] spoils', e?.message ?? e); }
    // the HUD
    const hidden = !!deps.hudHidden?.();
    drawKetchHud(ketchHudModel(V, t, { carrying: link.carrying() }), { hidden });
    hudUp = true;
    const bar = V.ws && (zone === 'bridge' || zone === 'gangway' || zone === 'cabin') ? wardenBarModel(V.ws, t, ketchVoyageOf(V.n).endAt) : null;
    if (bar || barUp) { drawGateBossBar(bar, { hidden }); barUp = !!bar; }
  }
  function offShip() {
    if (hudUp) { drawKetchHud(null); hudUp = false; }
    if (barUp) { drawGateBossBar(null); barUp = false; }
    link.leave(); fight.leave(); ride = null; forced = false;
    void shares.give();   // the chest unopened: my share into the pack
    try { spoils.gather(); deps.changed?.(); } catch (e) { console.warn('[kt] spoils', e?.message ?? e); }   // AUDIT KETCH L3-13: a save asked for
  }

  registerPlayerDeathSave('kt-fall', () => { if (!onShip()) return false; if (!lieDown('death')) fall('death'); return true; });   // AUDIT WORLD-EVENTS L1-4: down first

  return {
    /** A word from my ship's room (net/online.js onKetch): a receipt kept and carried, the count's fall of me, else folded. */
    word(w) {
      if (!w) return;
      if (w.k === 'rcpt') { claims.add(w.r); return; }
      if (w.k === 'bd') { if (!lieDown('count')) fall('count'); return; }   // AUDIT WORLD-EVENTS L1-4: down first
      if (w.k === 'rez' && w.s === me() && down) { down = null; entity.health = Math.max(1, Math.round((entity.maxHealth ?? 1) * KT_REZ_PCT)); mid(t('kt.raised', '{name} raises you.', { name: w.by || t('resurrect.companion', 'Your companion') })); return; }   // AUDIT WORLD-EVENTS L1-4
      if (w.k === 'rez' && w.s !== me()) say(t('kt.raisedOther', '{by} raises {name}.', { by: w.by, name: w.n }));
      if (!onShip()) return;
      const kept = ketchShipKept(w, me(), ship(), social()?.party?.id ?? null);
      if (kept) keepShip(kept);
      link.word(w);
      if (w.k === 'bank' && w.s === me()) noteAct('ketch-cell-banked');
    },
    /** One frame: the voyage's words, the sky outside, the ship aboard, the receipts. */
    frame() {
      const t = now();
      voyageWords(t);
      const aboard = onShip();
      if (aboard && !wasOnShip) { link.leave(); fight.leave(); }
      if (!aboard && wasOnShip) offShip();
      wasOnShip = aboard;
      if (aboard) { downFrame(); aboardFrame(t); }   // AUDIT WORLD-EVENTS L1-4: a body lying down held where it fell
      const o = online();
      if (o) o.poseDown = aboard && down ? () => down?.spot ?? null : null;
      // AUDIT KETCH II L2-1: off the ship - the sky, the lift's ride up and the fall's waking (an `else` hung on `!aboard`'s
      // one line ran them aboard alone, where the mode is never the exterior: she was never drawn and nobody boarded)
      if (!aboard) {
        down = null;
        if ((modes()?.mode ?? 'exterior') === 'exterior') {
          try { sky.frame(); } catch (e) { console.warn('[kt] sky', e?.message ?? e); }
          if (falling) {
            // woken in the fields under her lift
            falling = null;
            if (entity.maxHealth > 0) entity.health = Math.max(entity.health, Math.max(1, Math.round(entity.maxHealth * KT_FALL_WAKE)));
            mid(KT_WORDS.died);
          }
        }
      }
      claims.tick();
    },
    /** She and her lift in the exterior's world pass. */
    drawSky: (r) => ((modes()?.mode ?? 'exterior') === 'exterior' ? sky.draw(r) : 0),
    /** THE NETS' CAST-BACK (the dungeon host's, after it stood me back): its cost and its line. */
    castBack() {
      if (entity.health > 0) { const n = Math.max(1, Math.round((entity.maxHealth ?? 0) * KT_CAST_BACK_LOSS)); hurtPlayer(entity, n, { bypassShield: true, spare: () => {} }); flashPlayerDamage(n); }   // a setback, never a death (the Steps' own law)
      if (link.carrying()) online()?.sendKetch?.('drop');
      mid(KT_WORDS.castBack);
    },
    // the dungeon host's seams (scenes/ketch/ketchDeckHost.js)
    boss: () => fight.bossTarget(),
    bossHit: (h) => fight.bossHit(h),
    forks: () => fight.forkTargets(),
    forkHit: (h) => fight.forkHit(h),
    hostTargets: () => fight.hostTargets(),
    hostHit: (h) => fight.hostHit(h),
    batches: () => fight.batches(),
    voyage: () => link.state(),
    now: () => now(),
    clock: () => now() / 1000,
    /** Where a carried cell is drawn (the dungeon's frame): in my hands, and in each carrier's my screen draws. */
    carried() {
      const out = [];
      const cs = link.carriers(), mine = me();
      for (const sub of cs) {
        if (sub === mine) { const f = player.feetAt(), y = cam.yaw ?? 0; out.push([f[0] + Math.sin(y) * 0.5, f[1] + 0.85, f[2] + Math.cos(y) * 0.5]); continue; }
        const p = peers().find((q) => q.sub === sub)?.pos;
        if (p) out.push([p[0], p[1] + 0.85, p[2]]);
      }
      return out;
    },
    targets, name, press,
    /** The Ketchmaster's hold's pool (the floor a press, a plaque and the ray ask of aboard), and its doors for the hosts:
     *  the realm save's records held and landed, and the crash's door at a stand-up - the pool's records and my shares
     *  still owed (AUDIT KETCH L2-2, L2-3). */
    spoils,
    spoilsHeld: (id) => { try { return spoils.heldIds?.(id) ?? []; } catch { return []; } },
    spoilsLanded(id, ids) { try { spoils.saved(id, ids); } catch (e) { console.warn('[kt] spoils', e?.message ?? e); } },
    recoverSpoils(id, inSave = null) {
      try { if (recoverSpoils(deps.store ?? null, takeSpoil, { who: id, saves: enumerateSaves().info.values(), onHanded: (rec) => spoils.adopt(rec), key: KT_SPOILS_KEYS.store, inSave })) mid(KT_SPOILS_TEXT.granted); } catch (e) { console.warn('[kt] spoils', e?.message ?? e); }
      void shares.give();
    },
    lights: () => [...fight.lights(), ...(spoils.lights?.() ?? NONE)],
    /** KETCH-LOOK KL3: the deck's halos this frame, for the late pass (the fight draws them with its telegraphs). */
    halos: (list) => fight.halos(list),
    /** The telegraphs and the spoils' lines, after the flats. Answers whether anything drew. */
    drawPass(proj, view, eye, seconds, fog) {
      const a = fight.drawPass(proj, view, eye, seconds, fog), b = !!spoils.drawPass?.(proj, view, eye, seconds, fog);
      return a || b;
    },
    offerBodies: (lane) => fight.offerBodies(lane),
    /** On the Sailwalk - the made level's traversal ground (its flight refused there - systems/madeLevel.js). */
    onTraverse: () => { const f = feetDeck(); const z = f ? deckZoneAt(f[0], f[1], f[2]) : null; return z === 'sailwalk' || z === 'top'; },
    /** Her ring on the held map (ui/heldMap.js `ketch` - the gate's mark's shape, ui/ketch/ketchMapMark.js): about Daggerfall while
     *  she is in its sky, or null. */
    mapMark() {
      const t = now(), pose = ketchSkyPose(t);
      if (!pose) return null;
      const lines = [ketchSkyPhase(pose.phase), ketchWhenLine(t)];
      const px = cityRead()?.px ?? KT_CITY_PX;
      return { day: pose.v.n, cx: px.x + 0.5, cy: px.y + 0.5, r: KT_RING_R, label: KT_WORDS.name, phase: pose.phase, tip: { title: KT_WORDS.name, lines } };
    },
    /** The ship's crew aboard as the room says it (the party panel's, tests). */
    crew: () => link.state().crew,
    /** Is the made level a ship now. */
    aboard: () => onShip(),
    /** Board now (tests, `/ketch board`). */
    board,
    /** The parts (tests). */
    link, claims, fight, sky,
  };
}
