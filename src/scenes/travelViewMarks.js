// HOST-SPLIT: moved verbatim out of src/scenes/world.js's bootWorld (bible/01-Overview/Host-Split.md) by tools/hostMove.mjs.
// The host constructs it where the code stood. What it reads of the host's scope comes through `host`: the
// settled names by value at construction, every live one (a `let` someone writes, a `const` made below) read at its
// use as `host.<name>` - as the code read them where it was.
import { bandLabel } from '../systems/travel/travelBands.js';
import { dungeonTierLabel } from '../world/dungeon/dungeonLabel.js';
import { farDistanceText, PIXEL_KM } from '../systems/travel/travelFarPlaces.js';
import { getPref } from '../systems/uiPrefs.js';
import { isShipMark, travellerWorldOf } from '../systems/travellerMarks.js';
import { isWaypointFollowed, mapPointToNative, shownWaypoints } from '../systems/map/mapWaypoints.js';
import { livingWorldOn } from '../systems/livingWorld/livingSwitch.js';
import { LODE_COMPASS_CSS, lodeLabel } from '../ui/lodeMapMark.js';
import { mapPixelToWorldCoords } from '../world/streamingWorld.js';
import { markShown, travellerKin } from '../systems/travel/travelViewFilters.js';
import { t } from '../systems/textManager.js';   // OW-FORECAST: a card's weather line in the player's language
import { NAME_RANGE } from '../net/remotePlayers.js';
import { pixelOfNative, RAIDER_LABEL } from '../systems/seaRaiders.js';
import { playerEntity } from '../characters/playerEntity.js';
import { marksOn, questMapMarks } from '../ui/quest/questMarks.js';
import { questTracker } from '../ui/quest/questTracker.js';
import { skyMinutes } from '../systems/worldTick.js';
import { tierPhrase } from '../systems/dungeon/dungeonTier.js';
import { RANGE_PIXELS as TV_BODY_RANGE } from '../net/wire.js';
import { TV_DUNGEON_TYPES } from '../systems/travel/travelDungeons.js';
import { vendorWaypoint } from '../systems/vendorWaypoint.js';
import { warmAshesOn } from '../systems/warmAshesShips.js';
import { WILD_MARK } from '../systems/wild/wildAlert.js';
import { WILD_TEXT } from '../systems/wild/wildZone.js';

/** OW-QUEST: a quest mark's words on the Overworld - the first quest's title (the followed one first, questMapMarks'
 *  order) with how many more stand at the place, and under it the distance and the first quest's time left (AUDIT
 *  OW-REVISITED L5-7: the followed one's where it stands here). The place itself is the town's plate's to say (or the
 *  card's, on a hover). */
export const QUEST_OW_TITLE_MAX = 40;
export function questMarkWords(q, distance) {
  const quests = Array.isArray(q?.quests) ? q.quests : [];
  let title = String(quests[0]?.title || q?.label || '');
  if (title.length > QUEST_OW_TITLE_MAX) title = `${title.slice(0, QUEST_OW_TITLE_MAX - 1).replace(/\s+\S*$/, '')}\u2026`;
  const more = quests.length > 1 ? ` (+${quests.length - 1})` : '';
  const left = String(quests[0]?.left ?? '');
  return { label: `${title}${more}`, sub: left ? `${distance} \u00b7 ${left}` : distance };
}

/** @param {any} host */
export function createTravelViewMarks(host) {
  const {
    TV_PLACE_LIFT, _bandChase, _bandSpent, _hiddenPeers, _lodesSensed, _peerMapPoses, _townOfMapId, _tvBountyHold,
    _tvLodeHold, _tvPartyHold, _tvVendorHold, _tvWaypointHold, _veils, _wildStrangerIds, bandMake, bandNowMs,
    bandPlace, cam, carriageTown, csaOn, exteriorFoes, livingHideoutsHostOf, lodeSense, lodeWords, motherlodeBook,
    myGuildTag, owForecast, params, player, playerTravelPixel, questPixel, seaRaidPeerChase, townEcon, state, travelViewBands, tvPlaceRect, tvPlaceSummary,
    travelViewCamps, travelViewDungeons, travelViewFarPlaces, travelViewPlaces, travelViewRaiders, travellerBook,
    tvRaid, tvSceneKept, tvTrip, tvTripLive, walkMode, wildCampKeys, wildHidesPlayer
  } = host;
  /** OVERWORLD NAMES: a player's badge as their name wears it in play - the relay's stamps, never a frame's own words. */
  const tvBadgeOf = (p) => ({ title: p.title ?? null, glyphs: Array.isArray(p.glyphs) ? p.glyphs : [], lv: p.lv ?? null, gt: p.gt ?? null, rb: p.rb ?? null });   // AUDIT-SEATS: and a Season's banner ribbon
  const TV_PEER_HEAD_M = 1.8;   // m: a peer's head when no body layer knows their height
  const _tvQuestHold = new Map();   // OW-QUEST: each quest place's point, kept by its key between frames (the bounties' own way)
  /** OW-FORECAST (scenes/overworldForecastHost.js): A PLACE'S CARD - its own next hours first ("Weather: Rain - clearing in
   *  about 2 h", the map's word at its middle, never one invented), then its town's card (TOWN-ECON's, online) under it;
   *  the weather alone where the town has none. Made only when its plate is asked (the HUD's hover). */
  const placeTip = (econ, name, x, z) => () => {
    const base = econ?.() ?? null;
    const sky = owForecast?.placeLine({ x, z }) ?? '';
    if (!sky) return base;
    return { title: base?.title ?? name, lines: [t('travelView.tip.weather', 'Weather: {sky}', { sky }), ...(base?.lines ?? [])] };
  };
  /** The readout's marks: the plates (the journey's own end hides its plate), and the end. World points - the view
   *  projects them through the frame's matrices. */
  function travelViewMarks() {
    const live = tvTripLive();
    if (!live) { tvTrip.plan = null; tvTrip.natives = []; tvTrip.end = null; tvTrip.line = ''; }
    const endKey = live && tvTrip.plan.summary ? `place:${tvTrip.plan.summary.mapId}` : null;
    const marks = [];
    for (const p of travelViewPlaces()) {
      if (p.key === endKey) continue;
      const tier = params.has('online') ? tierPhrase(dungeonTierLabel(p.summary.loc)) : '';   // TIER1: a dungeon's tier and size under its name, online
      // OW-DUNGEON-DOT (2026-10-13, field: "some dungeons appear on the Overworld map as towns"): a found dungeon within the
      // grid wears TV2's plate (travelViewDungeons leaves it to this list), and every plate here was kind 'place' - a
      // town's brass dot, and the Towns switch's count. Its kind says so now: the dungeons' arch, the Dungeons switch.
      const isDungeon = TV_DUNGEON_TYPES.has(p.summary.loc?.mapTableData?.locationType);
      marks.push({ key: p.key, at: tvSceneKept(p, p.x, p.z, TV_PLACE_LIFT), label: p.summary.name, ...(tier ? { sub: tier } : {}), kind: isDungeon ? 'place dungeon' : 'place', pick: true, hub: carriageTown(p.summary.mapId), tip: placeTip(townEcon.tipFnAt(p.summary.mapId), p.summary.name, p.x, p.z) });   // OW-HUBS: a carriage town's wheel; SEAT-TIP: a seat's card; TOWN-ECON: every town's (made only when its plate is asked)
    }
    // TV5: the far places, held at the edge with their distance (the journey's own end is the flag's)
    const farEnd = endKey ? `far:${tvTrip.plan.summary.mapId}` : null;
    const here = state.worldCoords(player.pos);
    for (const f of travelViewFarPlaces()) {
      if (f.key === farEnd) continue;
      const km = (Math.hypot(f.x - here.x, f.z - here.z) / 32768) * PIXEL_KM;   // native units a pixel (MapsFile.WorldMapTerrainDim)
      marks.push({ key: f.key, at: tvSceneKept(f, f.x, f.z, TV_PLACE_LIFT), label: f.summary.name, sub: farDistanceText(km), kind: 'far', pick: true, edge: true, hub: carriageTown(f.summary.mapId), tip: placeTip(townEcon.tipFnAt(f.summary.mapId), f.summary.name, f.x, f.z) });   // OW-HUBS; SEAT-TIP; TOWN-ECON; OW-FORECAST: its weather
    }
    // TV6: THE DUNGEONS - a found one past the grid a far plate (within it TV2's plate stands - AUDIT OW3 D3: the list
    // leaves those out, so they spend none of its twelve), the rest unnamed lairs. AUDIT OW3 D1: a spawn the player has
    // been told of the same way - named once filed, its plate a walk to its door (travelViewSpawnWalk)
    for (const g of travelViewDungeons()) {
      if (g.found) {
        if (!g.spawn && `far:${g.row.mapID}` === farEnd) continue;
        const km = (Math.hypot(g.x - here.x, g.z - here.z) / 32768) * PIXEL_KM;
        const tier = params.has('online') ? tierPhrase(dungeonTierLabel(g.loc)) : '';   // TIER1: the tier and size before the distance, online
        marks.push({ key: g.key, at: tvSceneKept(g, g.x, g.z, TV_PLACE_LIFT), label: g.loc.name, sub: tier ? `${tier} - ${farDistanceText(km)}` : farDistanceText(km), kind: 'far dungeon', pick: true, edge: true });   // OW-FILTER: 'dungeon' - the look is the first word's, the filter's group the second's
      } else marks.push({ key: g.key, at: tvSceneKept(g, g.x, g.z, TV_PLACE_LIFT), label: '?', kind: 'lair' });
    }
    // LW3: THE ROAD'S PARTIES - a caravan, pilgrims, a pedlar, each where it is and where it is bound (scenes/livingWorld/livingRoads.js)
    if (host.livingRoads && livingWorldOn()) {
      for (const m of host.livingRoads.marks()) if (markShown({ kind: m.kind })) marks.push({ key: m.key, at: [m.at[0], m.at[1] + 2, m.at[2]], label: m.label, kind: m.kind });
      // LW12: the hideouts of bands the character has heard of - rumoured, a ring
      const hereN = state.worldCoords(cam.pos);
      for (const m of livingHideoutsHostOf().marks(hereN.x, hereN.z, skyMinutes())) if (markShown({ kind: m.kind })) marks.push({ key: m.key, at: [m.at[0], m.at[1] + 2, m.at[2]], label: m.label, kind: m.kind });
    }
    // TV7: THE BANDS - each with its kind and number where it walks; one chasing me held at the edge, pointing
    const bms = bandNowMs();
    // AUDIT OW4 B6: none drawn where none can come - the camps' own switch off, or the enemy spawns held
    const shown = getPref('wildernessCamps') === false || playerEntity.preventEnemySpawns ? [] : [...travelViewBands()];
    for (const c of _bandChase.values()) if (!shown.some((o) => o.id === c.band.id)) shown.push(c.band);   // AUDIT OW3 T7-2: a chaser out of the list still seen
    for (const b of shown) {
      if (_bandSpent.has(b.id)) continue;
      const mk = bandMake(b);
      if (!mk) continue;
      const chasing = _bandChase.has(b.id), p = bandPlace(b, bms);
      marks.push({ key: `band:${b.id}`, at: tvSceneKept(b, p.x, p.z, 2), label: chasing ? `${WILD_MARK} ${bandLabel(mk.name, mk.mobileTypes.length)}` : bandLabel(mk.name, mk.mobileTypes.length), kind: chasing ? 'band chase' : 'band', edge: chasing, pick: true });   // OW6: the band's OWN number, the same for every player (a party it meets brings more - PSCALE1 - where it stands); WILD-ALERT: a chase is a band that noticed me - its mark
    }
    // OW6 (2026-09-29, the player: "If a camp is spawned, it should show in the overworld"): THE CAMPS - every group
    // standing about, a camp, a pack or a band stood: mine, and each peer's by the tags their frames carry
    // (world/campShared.js) - one mark where its living members stand, with its kind and its number; gone with its last
    const wildCamps = wildCampKeys();   // WILD-ALERT: a camp a member of which has noticed me wears the mark
    for (const c of travelViewCamps()) marks.push({ key: `camp:${c.key}`, at: [c.at[0], c.at[1] + 2, c.at[2]], label: wildCamps.has(c.key) ? `${WILD_MARK} ${c.label}` : c.label, kind: 'camp', pick: true }); for (const g of host.gatherHost?.overworldGroups(walkMode ? player.pos : cam.pos) ?? []) marks.push(g);   // OW-ATTACK: pressable; GATHER-OW: each profession's group of nodes near me, a glyph (scenes/gatherHost.js overworldGroups)
    // YARDS-FOUND (from play: "The new stable and transport merchant shops dont show on town maps/overworld"): each town's
    // Stable and Wagon Yard standing about me, its name over its ground and its signboard's emblem (scenes/merchantYardsHost.js
    // overworldMarks) - with the towns on the Towns switch
    for (const m of host.merchantYards?.overworldMarks() ?? []) marks.push(m);
    // SHIPYARDS-FOUND (Mac: "Everything should show on the map/overworld"): each port town's shipyard and lighthouse
    // standing about me (scenes/portHost.js overworldMarks), and its docks over the first quay laid (scenes/quayPool.js)
    for (const m of host.portHost?.overworldMarks() ?? []) marks.push(m);
    for (const m of host.quays?.overworldMarks() ?? []) marks.push(m);
    // BOUNTY-OVERWORLD (the player: "can the bounties also be shown on the overworld map"): EVERY BOUNTY I HOLD - its
    // hunt's pixel (the held map's black circle, scenes/bountyHost.js mapMarks), its foes and its distance, held at the
    // edge off the picture as the journey's end is, so the way to it is always shown
    const bountyIds = new Set();
    for (const b of host.bountyHost?.mapMarks?.() ?? []) {
      const px = Math.floor(b.cx), py = Math.floor(b.cy);
      if (!Number.isInteger(px) || !Number.isInteger(py) || !b.id) continue;
      bountyIds.add(b.id);
      const o = mapPixelToWorldCoords(px, py);
      const x = o.x + 16384, z = o.z + 16384;   // the pixel's middle, native units
      let h = _tvBountyHold.get(b.id);
      if (!h) { h = {}; _tvBountyHold.set(b.id, h); }
      const km = (Math.hypot(x - here.x, z - here.z) / 32768) * PIXEL_KM;
      h.snap = { px, py, x, z, place: !!b.place, farmKey: b.farmKey ?? null };   // BOUNTY-SNAP: where its click walks
      marks.push({ key: `bounty:${b.id}`, at: tvSceneKept(h, x, z, TV_PLACE_LIFT), label: `Bounty: ${b.label}`, sub: farDistanceText(km), kind: 'bounty', edge: true, pick: true });   // BOUNTY-SNAP: pressable, on its ring alone (ui/travel/travelViewHud.js pickBox)
    }
    for (const id of [..._tvBountyHold.keys()]) if (!bountyIds.has(id)) _tvBountyHold.delete(id);   // a bounty over lets its point go
    // OW-QUEST (2026-10-19, the owner, of the Overworld's gaps: "1. Do it"): WHERE THE QUESTS POINT - the held map's own
    // marks (ui/quest/questMarks.js questMapMarks: every active quest whose place is on the player's map, two quests at one
    // place one mark), each at its PLACE's middle (AUDIT OW-REVISITED L5-1: the place's own rect, as its plate and the
    // journey's end stand - the pixel's middle stood a hundred metres off the main quest's eight off-middle dungeons; the
    // pixel's middle only where the place is not known), a diamond in the journal's gold, the followed quest's filled and
    // held at the edge off the picture with its distance (the compass's TRACK-ONLY: the one being followed is never off the
    // screen) - unless the journey under way is bound there, whose own end is held (L5-5: one arrow a place) - the rest
    // where they lie. Pressed, a journey there (by the Path switch's way, as every press of the view's). Under the quest
    // marks' own switch (marksOn), never the map filters' (a quest is never cluttering - it is the point)
    {
      const keep = new Set();
      for (const q of marksOn() ? questMapMarks(questTracker.views, questTracker.shown()?.id ?? null, questPixel) : []) {
        let h = _tvQuestHold.get(q.key);
        if (!h) { h = {}; _tvQuestHold.set(q.key, h); }
        if (!h.mid) { const s = tvPlaceSummary(q.px, q.py), r = s ? tvPlaceRect(s) : null; if (r) h.mid = { x: r.cx, z: r.cz }; }   // its place's middle, read once a mark
        const o = h.mid ? null : mapPixelToWorldCoords(q.px, q.py);
        const x = h.mid?.x ?? o.x + 16384, z = h.mid?.z ?? o.z + 16384;   // native units
        keep.add(q.key);
        const km = (Math.hypot(x - here.x, z - here.z) / 32768) * PIXEL_KM;
        const bound = live && tvTrip.end?.kind === 'dest' && Math.hypot(tvTrip.end.x - x, tvTrip.end.z - z) < 1;   // the journey's own end, held as its own
        marks.push({ key: q.key, at: tvSceneKept(h, x, z, TV_PLACE_LIFT), ...questMarkWords(q, farDistanceText(km)), kind: q.tracked ? 'quest tracked' : 'quest', tip: q.tip, edge: q.tracked && !bound, pick: true });
      }
      for (const k of [..._tvQuestHold.keys()]) if (!keep.has(k)) _tvQuestHold.delete(k);   // a quest done lets its point go
    }
    // HOME-VENDOR: THE TRADER'S WAYPOINT - its town's pixel, in Travel Options' mark's own yellow (`target`), named for
    // the house and held at the edge off the picture with its distance, as a bounty is
    {
      const wp = vendorWaypoint();
      const t = wp ? _townOfMapId.get(wp.map) : null;
      if (t) {
        const o = mapPixelToWorldCoords(t.px, t.py);
        const x = o.x + 16384, z = o.z + 16384;
        const km = (Math.hypot(x - here.x, z - here.z) / 32768) * PIXEL_KM;
        marks.push({ key: `vendor:${wp.map}:${wp.buildingKey}`, at: tvSceneKept(_tvVendorHold, x, z, TV_PLACE_LIFT), label: `Trader: ${wp.owner || 'a'}'s house`, sub: `${t.name} · ${farDistanceText(km)}`, kind: 'target', edge: true });
      }
    }
    // AUDIT MINE-PERKS (the cold pass, A8 - the thread: "mark the motherlode spots with a waypoint on the travel map"): A
    // MOTHERLODE SENSE'S MOTHERLODES on the Overworld too - each at its pixel's middle, its ore and its hour, held at the
    // edge off the picture with its distance as a bounty is; Mining's glyph in the compass's aqua, under the Gathering
    // switch, its distance never the nodes' reach (no `dist`)
    {
      const keep = new Set();
      if (lodeSense()) {
        const nowS = Math.floor((Date.now() + host._sharedOffsetMs) / 1000);
        for (const l of motherlodeBook.sensedAll(_lodesSensed)) {
          keep.add(l.key);
          const o = mapPixelToWorldCoords(l.x, l.y);
          const x = o.x + 16384, z = o.z + 16384;   // the pixel's middle, native units
          let h = _tvLodeHold.get(l.key);
          if (!h) { h = {}; _tvLodeHold.set(l.key, h); }
          const km = (Math.hypot(x - here.x, z - here.z) / 32768) * PIXEL_KM;
          marks.push({ key: `lode:${l.key}`, at: tvSceneKept(h, x, z, TV_PLACE_LIFT), label: lodeLabel(l, nowS, lodeWords), sub: farDistanceText(km), kind: 'gather mining', color: LODE_COMPASS_CSS, edge: true });
        }
      }
      for (const k of [..._tvLodeHold.keys()]) if (!keep.has(k)) _tvLodeHold.delete(k);   // a Motherlode gone lets its point go
    }
    // WAYPOINTS (2026-10-06): THE FLAGS - every waypoint the switches show, a small flag in its colour where it lies; a
    // FOLLOWED one held at the screen's edge with its distance, as a bounty is (the rest only where they are in view).
    // A click on one is a walk to it; a right-click its menu (onTravelViewContext)
    {
      const keep = new Set();
      for (const w of shownWaypoints()) {
        const n = mapPointToNative(w.mx, w.my);
        let h = _tvWaypointHold.get(w.id);
        if (!h) { h = {}; _tvWaypointHold.set(w.id, h); }
        keep.add(w.id);
        const followed = isWaypointFollowed(w.id);
        const km = (Math.hypot(n.x - here.x, n.z - here.z) / 32768) * PIXEL_KM;
        marks.push({ key: `wp:${w.id}`, at: tvSceneKept(h, n.x, n.z, 0), label: w.name, ...(followed ? { sub: farDistanceText(km) } : {}),
          kind: `waypoint ${w.kind}`, color: w.color, wpKind: w.kind, followed, edge: followed, pick: true });
      }
      for (const id of [..._tvWaypointHold.keys()]) if (!keep.has(id)) _tvWaypointHold.delete(id);
    }
    // AUDIT DEEP2 B-1: THE JOURNEY'S END IS NEVER OFF THE SCREEN UNSEEN - held at the edge as a far place is (a far town's
    // plate gave way to a flag drawn above the picture, and the destination was gone for the whole journey), a place's
    // with its distance, and a click on a place's flag is its journey again (after a stop there is no ground to click)
    if (live && tvTrip.end) {
      const e = tvTrip.end, place = e.kind === 'dest';
      const km = place ? (Math.hypot(e.x - here.x, e.z - here.z) / 32768) * PIXEL_KM : NaN;
      marks.push({ key: 'dest', at: tvSceneKept(e, e.x, e.z, place ? TV_PLACE_LIFT : 0), label: e.label, kind: e.kind, edge: true, ...(place ? { pick: true, sub: farDistanceText(km) } : {}) });
    }
    // OVERWORLD NAMES (2026-09-28, Mac: "Full, like in play"): THE PLAYERS DRAWN HERE - within the pose range, their
    // bodies standing - marked as the region's travellers are, over their heads, NAMED AS THEY ARE IN PLAY (the title
    // above, the Renown, the name, the guild's tag, the glyphs; my party's in its green). From the view's eye the names
    // over their heads were past NAME_RANGE (60 m) - the eye stands 40-780 m back (the height over the tilt's tangent;
    // about 200 m as it opens) - so the players nearest (a party travelling together) went nameless; those names stand
    // down under the view (drawPeerNames) and these stand for them
    const near = new Set();
    const book = travellerBook.live(Date.now());
    const sharing = new Map();   // the region's travellers by id: the players who share where they are with it
    for (const t of book) sharing.set(t.id, t);
    const myGt = myGuildTag();   // OW-KIN: asked once a frame, not once a player
    // the room's drawable peers, as this frame's onlineFrame sifted them (it runs before the readout): the concealed
    // (`_hiddenPeers`) and the veiled (`_veils`) are never marked
    // PVPGIANT: the zone's roaming giants on the Overworld, as the enemies they are (never more than two stand)
    for (const gf of exteriorFoes.foes) { if (gf.entity?.wildGiant && !(gf.entity.health <= 0) && gf.ai?.feet) marks.push({ key: `giant:${gf.id ?? gf.entity.name ?? marks.length}`, at: [gf.ai.feet[0], gf.ai.feet[1] + 8, gf.ai.feet[2]], label: 'Giant', kind: 'stranger', edge: true }); }
    for (const d of host.online?.drawable?.() ?? []) {
      if (!d?.shown || _hiddenPeers.has(d.id) || _veils.has(d.id)) continue;
      const f = host.onlineToScene(_peerMapPoses.get(d.id) ?? d.shown);
      // WILD3 (the owner: "when other players are near you they are counted as enemies bright red and its called stranger
      // when you near them Like 600m away"): in the open zone a stranger within WILD_STRANGER_M stands as an enemy
      if (_wildStrangerIds.has(d.id)) {
        near.add(d.id);
        marks.push({ key: `peer:${d.id}`, at: [f[0], f[1] + TV_PEER_HEAD_M, f[2]], label: WILD_TEXT.stranger, kind: 'stranger', edge: true });
        continue;
      }
      // AUDIT NAMES N2-2: THE SWITCH HOLDS - a player who shares nothing with the region ("Show me to travellers" off)
      // and is not of my party is named only as close as play names them (NAME_RANGE from where I stand) and never held
      // at the edge; my party, and a player whose mark the region already has, are named wherever they stand
      const party = !!host.social?.isPartyPeer(d.id), t = sharing.get(d.id);
      if (!party && !t && Math.hypot(f[0] - player.pos[0], f[2] - player.pos[2]) > NAME_RANGE) continue;
      if (wildHidesPlayer({ kin: travellerKin({ friend: !!host.social?.isFriendPeer(d.id), gt: d.gt }, myGt), wire: [d.shown.x, 0, d.shown.z], party })) continue;   // WILD1: in or near the open zone, my party and my guild alone
      const h = host.peerRiders.heightOf(d.id) || host.peerBodies.heightOf(d.id) || host.peerWalkers.heightOf(d.id) || TV_PEER_HEAD_M;
      near.add(d.id);
      // AUDIT NAMES: and one on a journey (their region mark's `tv`) keeps the arrow they wore from afar
      marks.push({ key: `peer:${d.id}`, at: [f[0], f[1] + h, f[2]], label: d.name ?? '', kind: `${party ? 'party' : 'traveller'}${isShipMark(t?.p) ? ' ship' : ''}${t?.p.tv ? ' journey' : ''}`, edge: party || !!t, badge: tvBadgeOf(d),
        kin: travellerKin({ friend: !!host.social?.isFriendPeer(d.id), gt: d.gt }, myGt), lv: d.lv ?? null });   // OWS1: at sea (their region mark says so), a ship; OW-KIN / OW-WHO: who they are to me, and their Renown
    }
    // TV3: THE REGION'S TRAVELLERS - their marks, beyond the pose range (inside it they are the players above); a party
    // member's in the party's colour; one outside the picture held at its edge, pointing
    const me = playerTravelPixel();
    for (const t of book) {
      if (near.has(t.id) || Math.max(Math.abs(t.p.px - me.x), Math.abs(t.p.py - me.y)) <= TV_BODY_RANGE) continue;
      const w = (t._w ??= travellerWorldOf(t.p));   // PERF-TV: a book entry is made new by each mark heard, so it is kept on it
      // AUDIT TV C3: the peer's id, asked of the party's seats (a token's subject is another id space) - AUDIT NAMES N1-10:
      // as play's names ask it (colorOf), so my own other tab is never my party's green
      const kind = host.social?.isPartyPeer(t.id) ? 'party' : 'traveller';
      if (wildHidesPlayer({ kin: travellerKin({ friend: !!host.social?.isFriendPeer(t.id), gt: t.gt }, myGt), wire: [w.x, 0, w.z], party: kind === 'party' })) continue;   // WILD1: in or near the open zone, my party and my guild alone
      const ship = isShipMark(t.p);   // OWS1: at sea, a ship - riding the sea's top
      marks.push({ key: `trav:${t.id}`, at: tvSceneKept(t, w.x, w.z, 2, ship), label: t.name, kind: `${kind}${ship ? ' ship' : ''}${t.p.tv ? ' journey' : ''}`, edge: true, badge: tvBadgeOf(t),
        kin: travellerKin({ friend: !!host.social?.isFriendPeer(t.id), gt: t.gt }, myGt), lv: t.lv ?? null });   // OW-KIN / OW-WHO
      near.add(t.id);
    }
    // AUDIT OW5 P6: MY PARTY, WHEREVER THEY ARE - the held map draws them from the party's own poses (partyMarkers); here
    // a member past the pose range with "Show me to travellers" off, or over a region's border, stood on no mark at all,
    // and the one who fell behind a group journey vanished from the leader's view. Their pose's pixel, in the party's
    // colour, held at the edge - never twice (one marked above, by a body or the region's mark, stands as that)
    for (const m of host.social?.others() ?? []) {
      if (!Number.isInteger(m.p?.px) || !Number.isInteger(m.p?.py) || (m.peers ?? []).some((id) => near.has(id))) continue;
      const o = mapPixelToWorldCoords(m.p.px, m.p.py);
      let h = _tvPartyHold.get(m.acct);
      if (!h) { h = {}; _tvPartyHold.set(m.acct, h); }
      marks.push({ key: `pty:${m.acct}`, at: tvSceneKept(h, o.x + 16384, o.z + 16384, 2), label: m.name ?? '', kind: 'party', edge: true });
    }
    // OWS3: WARM ASHES' RAIDERS - the sails within the grid's reach where they sail, and one giving chase wherever it is,
    // held at the edge off the picture, pointing
    // AUDIT OW5b S8: none drawn where none can come - no Come Sail Away, no boat to be at sea in (the bands' own B6)
    if (warmAshesOn() && csaOn()) {
      const grid = Math.max(1, state.terrainDistance ?? 3);
      const listed = travelViewRaiders();
      for (const r of listed) {
        const c = tvRaid.chase.get(r.id);
        const ship = host.navalRaidersOn() ? host.naval.raiderShipOf(r.seed) : null;   // NAV-R: stood as a ship of the sea - drawn where she sails
        if (tvRaid.spent.has(r.id) && !c && !ship) continue;
        const at = ship ? state.worldCoords(ship.pos) : c ? c.pos : (seaRaidPeerChase(r.id) ?? r);   // OW6: one a peer's chase holds, where they say it sails
        const chase = ship ? ship.chase : !!c;
        const px = pixelOfNative(at.x, at.z);
        if (!chase && Math.max(Math.abs(px.x - me.x), Math.abs(px.y - me.y)) > grid) continue;
        marks.push({ key: `raid:${r.id}`, at: tvSceneKept(c ?? r, at.x, at.z, 2, true), label: RAIDER_LABEL, kind: chase ? 'raider ship chase' : 'raider ship', edge: chase });
      }
      // AUDIT OW5b S3: A CHASE OUT OF THE LIST STILL SEEN - its raider's life turned over (the list is this life's), and it
      // came alongside unseen: "one giving chase is marked wherever it is" (the bands' own T7-2)
      for (const [id, c] of tvRaid.chase) {
        if (listed.some((r) => r.id === id)) continue;
        marks.push({ key: `raid:${id}`, at: tvSceneKept(c, c.pos.x, c.pos.z, 2, true), label: RAIDER_LABEL, kind: 'raider ship chase', edge: true });
      }
    }
    return marks;
  }
  return { travelViewMarks };
}
