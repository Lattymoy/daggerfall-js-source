// @ts-check
// LIVING CREW - THE HOST (2026-09-29, Mac: "Crew members shouldnt be the static sprites and instead the enemy type
// sprites with multiple animations, they should navigate the deck, talk with each other, blurb, sing chantys, etc"):
// every crewed ship near the eye stands her crew (systems/naval/crewLife.js) as DFU's own mobile units - the classes'
// sprites, idle and walking, turned to the eye as DFU's DaggerfallMobileUnit turns them (characters/mobileUnit.js) - on
// her deck, carried by her mesh node (her way, her turn, her roll), with the lines over their heads for the naval HUD.
//
// THE FLATS. Come Sail Away stands a hull's crew as its people flats (TEXTURE.182/183/346, world/rdbLayout.js
// NPC_FLAT_ARCHIVES). Within CREW_RANGE of the eye the flats on or above her deck stand down (their renderer off, the
// pool's flats pass skips them) and her living crew stands in their places; past CREW_KEEP they stand again - a far
// ship's crew is a handful of pixels, and the flats cost nothing. The ones below her deck (a galley's rowers at their
// oars) are never touched.

import { MobileUnit } from '../characters/mobileUnit.js';
import { ENEMY_BASICS } from '../characters/enemyBasics.js';
import { mobileBillboardSize } from '../world/rmbFlats.js';
import { NPC_FLAT_ARCHIVES } from '../world/rdbLayout.js';
import { intoDeck, outOfDeck, mainLevel, DECK_STEP } from '../systems/naval/navalDeck.js';
import { createCrewLife, CREW_MUSTER_M } from '../systems/naval/crewLife.js';
import { createPersonTextureKeys } from './townScratch.js';
import { createPopulationLane } from '../characters/npcBodies.js'; import { rosterLook } from '../characters/foeBodies.js'; import { rosterActor } from '../characters/rosterBodies.js';   // MWNPC10: the crews in their Morrowind bodies

/** Her main deck's level - the deck's own (navalDeck.js), read here by the suites as it always was. */
export { mainLevel };

/** A ship's crew stands within this of the eye (m), and is kept to CREW_KEEP (a band, so it never flickers). */
export const CREW_RANGE = 110;
export const CREW_KEEP = 130;
const PEOPLE = new Set(NPC_FLAT_ARCHIVES);
const _flats = new WeakMap();

/**
 * A hull's people flats, as the pool stands them: each billboard node of a people archive, its renderer, and where its
 * feet stand in her deck's frame (her mesh node's - they hang under it, so it never changes). AUDIT NAV2 F58: walked once
 * a boat and rig, handed back after (a walk of the whole hull, 0.13 ms and 149 KB, at every crew's first sight) - walked
 * again when her variant changes (the pool's own walk's law).
 * @param {any} boat
 */
export function peopleFlatsOf(boat) {
  const memo = _flats.get(boat);
  if (memo && memo.variant === boat.variant) return memo.list;
  const out = [];
  const m = boat?.MeshObject?.worldMatrix?.();
  if (!m || !boat.GameObject) return out;
  const walk = (n) => {
    for (let i = 0; i < n.childCount; i++) {
      const c = n.getChild(i);
      if (!c.activeSelf) continue;
      const bb = c.getComponent?.('DaggerfallBillboard');
      const r = c.getComponent?.('MeshRenderer');
      if (bb && r && PEOPLE.has(bb.Summary?.Archive)) {
        const w = c.worldMatrix();
        const h = bb.Summary.Size?.[1] ?? 1.8;
        out.push({ node: c, renderer: r, archive: bb.Summary.Archive, record: bb.Summary.Record, feet: intoDeck(m, [w[12], w[13] - h / 2, w[14]]) });
      }
      walk(c);
    }
  };
  walk(boat.GameObject);
  _flats.set(boat, { variant: boat.variant, list: out });
  return out;
}

/**
 * The crew host.
 * @param {{ renderer: any, getTexture: (archive: number) => Promise<any>, uploadRecordFrame: (a: number, r: number, f: number) => void, rand?: () => number,
 *   wantBodies?: () => boolean, makeBodies?: (() => any) | null }} o
 */
export function createNavalCrew({ renderer, getTexture, uploadRecordFrame, rand = Math.random, wantBodies = undefined, makeBodies = null }) {   // MWNPC10: the body lane's seams
  const bodiesLane = createPopulationLane({ laneName: 'crew', renderer, ...(wantBodies ? { want: wantBodies } : {}), make: makeBodies });   // MWNPC10 (section 15b): the crews' Morrowind bodies
  let _crewIds = 0;
  /** @type {Map<any, any>} key -> { key, boat, deck, life, sprites: Map<member, sprite>, flats } */
  const ships = new Map();
  const _dir = [0, 0, 0], _fw = [0, 0, 0];
  // AUDIT NAV2 F59: a crewman's frame minted no garbage (about 550 bytes of it a crewman a frame) - his unit's motion one
  // object for the host, the texture cache's key memoised on its three numbers (PERF-TOWN1's) and his record's,
  // `record#frame` (MAC4's shape), once a record and frame
  const _motion = { moving: false, striking: false };
  const textureKey = createPersonTextureKeys();
  const _records = new Map();
  const recordKey = (record, frame) => { const k = record * 1024 + frame; let v = _records.get(k); if (v === undefined) { v = `${record}#${frame}`; _records.set(k, v); } return v; };

  function sprite(member) {
    const basics = ENEMY_BASICS[member.mobile];
    if (!basics) return null;
    const archive = member.gender === 'female' ? basics.femaleTexture : basics.maleTexture;
    const s = { id: `crew:${++_crewIds}`, archive, tex: null, unit: null, batch: null, origin: [0, 0, 0], dead: false, yaw: 0, swings: 0, swinging: false };   // MWNPC10: its lane id, its world facing and its blows
    getTexture(archive).then((tex) => {
      if (s.dead || !tex) return;
      s.tex = tex;
      s.unit = new MobileUnit(member.mobile, basics, (rec) => tex.getFrameCount(rec), rand, member.gender);
      s.batch = renderer.createBillboardBatch(archive, 0, { w: 1, h: 1 }, [[0, 0, 0]]);
    }).catch(() => {});
    return s;
  }
  const drop = (s) => { if (!s) return; s.dead = true; if (s.batch) renderer.destroyBillboardBatch?.(s.batch); s.batch = null; };
  function standDown(ship) {
    for (const s of ship.sprites.values()) drop(s);
    ship.sprites.clear();
    for (const f of ship.flats) f.renderer.m_Enabled = f.was;   // the mod's flats stand again
  }

  /**
   * The crewed ships this frame, each `{ key, boat, deck, count, rosterOf, seed, faction, battle, struck, toward, hold }`
   * - one not named is stood down (its sprites gone, its flats back); a named one first seen stands her crew
   * (`rosterOf()`, asked then and when she grows) in her flats' places; one standing is kept to `count` (the guns took
   * the rest, a mending brings them back); a `hold` crew is off her deck (her men the fight's, a prize's) - her flats stay
   * down and nobody stands, and she stands again whole when the hold ends; `struck` her colours down; `toward` a
   * boarding at hand, the point her crew musters toward - stood to within CREW_MUSTER_M of her.
   * @param {any[]} list
   */
  function sync(list) {
    const want = new Set();
    for (const w of list) want.add(w.key);
    // AUDIT NAV2 F6: a ship re-keyed (a room's hand-over keeps her hull under a new id) keeps her crew - her entry moves
    // to her new key - and the rest out of the list stand down before any crew stands, so none reads a flat another has
    // down (a second crew stood beside the flats the first switched back on, and they stayed down once she left)
    for (const w of list) {
      if (ships.has(w.key)) continue;
      for (const [key, ship] of ships) if (ship.boat === w.boat && !want.has(key)) { ships.delete(key); ship.key = w.key; ships.set(w.key, ship); break; }
    }
    for (const [key, ship] of ships) if (!want.has(key)) { standDown(ship); ships.delete(key); }
    for (let w of list) {
      let ship = ships.get(w.key);
      // another hull under her key - F6: or her hold over, and she stands anew, whole (`held` was never let go)
      if (ship && (ship.boat !== w.boat || ship.held && !w.hold)) { standDown(ship); ships.delete(w.key); ship = null; }
      if (!ship) {
        if (!w.deck?.count || !(w.hold || w.count > 0)) continue;
        const main = mainLevel(w.deck);
        const flats = peopleFlatsOf(w.boat).filter((f) => f.feet[1] >= main - DECK_STEP);   // never the rowers below her deck
        for (const f of flats) { f.was = f.renderer.m_Enabled; f.renderer.m_Enabled = false; }
        const life = createCrewLife({ deck: w.deck, roster: w.hold ? [] : w.rosterOf(), seed: w.seed, places: flats.map((f) => f.feet), faction: w.faction ?? null });
        ship = { key: w.key, boat: w.boat, deck: w.deck, life, flats, sprites: new Map(), battle: false, held: !!w.hold, seed: w.seed | 0 };   // MWNPC10: her seed, her hands' looks
        for (const m of life.members) ship.sprites.set(m, sprite(m));
        ships.set(w.key, ship);
      }
      ship.battle = !!w.battle;
      ship.struck = !!w.struck;   // AUDIT NAV2 F46: her colours down - no song, no talk
      ship.mine = w.mine ?? null;   // SHIP-CREW: a boat of the player's - her crew's order, spirits and lines (navalHost myCrew)
      ship.work = Number.isFinite(w.work) ? w.work : 0;   // SHIP-WATCH: what her hurts leave her crew to mend (the sea's ships)
      // AUDIT NAV2 F40: a boarding at hand (a ship closing to board her, a struck one in my reach): her crew to the rail
      // toward it within CREW_MUSTER_M of her - the grapple's 2.2 s alone saw nobody reach it
      const at = w.boat.GameObject?.position;
      ship.toward = w.toward && at && Math.hypot(w.toward[0] - at[0], w.toward[2] - at[2]) <= CREW_MUSTER_M ? w.toward : null;
      // CREW-COMPANIONS: her hands ashore with the player (`away`, roster places) stand off her deck, and her count is
      // the rest's - the guns' trim and the mending's restore never touch a man ashore
      const off = w.away ? ship.life.away(w.away) : 0;
      if (off && !w.hold) w = { ...w, count: Math.max(0, w.count - off) };
      // AUDIT CC-A5: a hand home again stands with his sprite (one came home while another stayed ashore: the count
      // stood met, the mending's branch never ran, and he walked her deck unseen)
      if (w.away) for (const m of ship.life.members) { if (!m.gone && !ship.sprites.get(m)) ship.sprites.set(m, sprite(m)); }
      if (w.hold && !ship.held) { ship.held = true; ship.life.take(Infinity); }   // another's fight took them (a room's)
      else if (!w.hold && ship.life.standing() > w.count) ship.life.trim(w.count);
      else if (!w.hold && ship.life.standing() < w.count) {   // AUDIT NAV2 F42: mended - her crew grows back (it only ever thinned)
        ship.life.restore(w.count, ship.life.members.length < w.count ? w.rosterOf() : []);
        for (const m of ship.life.members) if (!m.gone && !ship.sprites.get(m)) ship.sprites.set(m, sprite(m));
      }
    }
  }

  /**
   * The crews' frame: each stepped (`ctxOf(key)` - her battle, her muster, the one to avoid, in her frame), then each
   * man carried out of her deck's frame by her mesh node now and his sprite turned to `eye`.
   * @param {number} dt @param {number[]} eye @param {(key: any, ship: any) => any} [ctxOf]
   */
  function frame(dt, eye, ctxOf) {
    for (const ship of ships.values()) {
      ship.life.step(dt, ctxOf?.(ship.key, ship) ?? { battle: ship.battle, struck: ship.struck });
      const m = ship.boat.MeshObject?.worldMatrix?.();
      if (!m) continue;
      for (const [member, s] of ship.sprites) {
        if (!s) continue;
        if (member.gone) { drop(s); ship.sprites.set(member, null); continue; }
        if (member.below || !s.unit || !s.batch) continue;   // SHIP-WATCH: turned in below her deck - kept, not drawn
        outOfDeck(m, member.pos, s.origin);
        // his facing, out of her frame: her node's turn of his forward
        _fw[0] = Math.sin(member.yaw); _fw[1] = 0; _fw[2] = Math.cos(member.yaw);
        _dir[0] = m[0] * _fw[0] + m[8] * _fw[2]; _dir[2] = m[2] * _fw[0] + m[10] * _fw[2];
        _motion.moving = member.moving;
        _motion.striking = !!member.swing;   // SHIP-WATCH: a swing at his work - his class's attack
        s.yaw = Math.atan2(_dir[0], _dir[2]);   // MWNPC10: kept - his body faces it
        if (member.swing && !s.swinging) s.swings++;   // MWNPC10: each swing begun, one blow
        s.swinging = !!member.swing;
        const out = s.unit.update(dt, _motion, s.yaw, s.origin, eye);
        if (!renderer.textures?.has?.(textureKey(s.archive, out.record, out.frame))) uploadRecordFrame(s.archive, out.record, out.frame);
        const sz = mobileBillboardSize(s.tex, out.record);
        s.batch.record = recordKey(out.record, out.frame);
        const bs = s.batch.size ??= { w: 0, h: 0 };   // written through, not replaced (PERF-TOWN1's): read by value at the draw, held by nothing
        bs.w = out.flip ? -sz.w : sz.w; bs.h = sz.h;
        s.batch.origin = s.origin;
        s.batch.conceal = ship.boat.conceal ?? null;   // AUDIT NAV2 F50: a concealed owner's crew wears his look, as the pool's flats did (AUDIT PRE-MERGE 0928 O4)
        s.head = s.head ?? [0, 0, 0];
        s.head[0] = s.origin[0]; s.head[1] = s.origin[1] + sz.h + 0.25; s.head[2] = s.origin[2];
      }
    }
  }

  /**
   * MWNPC10 (bible/04-Characters/Morrowind-NPCs.md section 15b): EVERY STANDING HAND IN HIS MORROWIND BODY, before the
   * world's people pass draws his sprite - his class's look off his ship's seed and his place in her roster (a creature
   * hand its creature), walking as he walks, each swing at his work a blow, concealed with his ship's owner.
   */
  function drawBodies(canvas, proj, view, eye, dt) {
    bodiesLane.frame();
    for (const ship of ships.values()) {
      let i = 0;
      for (const [m, s] of ship.sprites) {
        i++;
        if (!s?.batch || !s.unit || m.below) continue;   // turned in below her deck: kept, not drawn (a gone hand's sprite is already dropped)
        const look = rosterLook(s, { mobileType: m.mobile, gender: m.gender, seed: Math.imul((ship.seed | 0) + i, 0x9e3779b1) >>> 0 });
        if (!look) continue;
        bodiesLane.offer(rosterActor(s, { id: s.id, look, feet: s.origin, yaw: s.yaw, moving: !!m.moving, swingKey: s.swings || null }), s.batch, ship.boat.conceal ?? null);
      }
    }
    bodiesLane.draw(canvas, proj, view, eye, dt);
  }

  /** Every standing crewman's sprite, for the world's people pass. */
  function batches() {
    const out = [];
    for (const ship of ships.values()) for (const [m, s] of ship.sprites) if (s?.batch && s.unit && !m.below) out.push(s.batch);   // SHIP-WATCH: none below her deck
    return out;
  }

  /** The lines over their heads: [{ key, head, text, kind }] - `head` the world point over his sprite. */
  function speech() {
    const out = [];
    for (const ship of ships.values()) {
      for (const l of ship.life.speech()) {
        const s = ship.sprites.get(l.member);
        if (s?.head) out.push({ key: ship.key, member: l.member, head: s.head, text: l.text, kind: l.kind });
      }
    }
    return out;
  }

  /**
   * Up to `n` of a ship's crew taken off her deck (a boarding's muster, a party over the rail, the hands going over) -
   * `opts.from` standing men passed over first - each where he stands in the world now, which way he faces, his class
   * and his sex; their sprites gone.
   */
  function take(key, n, opts) {
    const ship = ships.get(key);
    if (!ship || !(n > 0)) return [];
    const m = ship.boat.MeshObject?.worldMatrix?.();
    const out = [];
    for (const t of ship.life.take(n, opts)) {
      const feet = m ? outOfDeck(m, t.pos) : [...t.pos];
      _fw[0] = Math.sin(t.yaw); _fw[2] = Math.cos(t.yaw);
      const yaw = m ? Math.atan2(m[0] * _fw[0] + m[8] * _fw[2], m[2] * _fw[0] + m[10] * _fw[2]) : t.yaw;
      out.push({ mobile: t.mobile, gender: t.gender, feet, yaw });
    }
    for (const [member, s] of ship.sprites) if (member.gone && s) { drop(s); ship.sprites.set(member, null); }
    return out;
  }

  return {
    sync, frame, batches, speech, take,
    drawBodies,   // MWNPC10
    /** MWNPC10: the concealed hands' bodies, translucent, after the people pass. */
    drawVeiledBodies() { bodiesLane.drawVeiled(); },
    /** MWNPC10: the floating origin moved - the bodies' feet follow it. */
    offsetBodies(o) { bodiesLane.offsetAll(o); },
    /** `take` by her boat (the naval host knows a ship by her boat). */
    takeByBoat(boat, n, opts) { for (const ship of ships.values()) if (ship.boat === boat) return take(ship.key, n, opts); return []; },
    /** A crew stood down and forgotten - the next sync stands her again whole (my hands home from a fight). */
    reset(key) { const ship = ships.get(key); if (ship) { standDown(ship); ships.delete(key); } },
    /** Whether `key`'s crew stands. */
    has: (key) => ships.has(key),
    /** The standing crews (a probe's and a test's). */
    ships: () => [...ships.values()],
    /** Every crew stood down, the flats all back. */
    clear() { for (const ship of ships.values()) standDown(ship); ships.clear(); bodiesLane.destroy(); },   // MWNPC10: and their bodies
  };
}
