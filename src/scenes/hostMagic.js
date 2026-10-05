// THE PLAYER-CAST ENGINE, shared by every host (M1, the AUDIT 23
// hosts-2 priority row). Extracted VERBATIM from dungeonContext.js's
// audited casting stack (S5/S7/S9/S10/S24/S27 + the AUDIT 23 magic
// fixes) so the two exterior hosts and the interior arm ride the same
// laws instead of none - a Mage could not cast in town. DFU sources:
// EntityEffectManager.cs (SetReadySpell :315-351, CastReadySpell,
// SilenceCheck :1932-1946, the absorb refund cap :600-604, the tally
// :2106/:1964-1978) and DaggerfallMissile.cs (flight, DoCollision
// :399-402, TargetTypes).
//
// The engine owns: the readied spell + the click-to-cast latch, the
// four range arms, the school tallies + cast sound, the self-cast
// cost for the absorption refund cap, applySpellToPlayer's message
// arms, explodeAt, and spell missiles (flight, wall explode, foe
// seek, billboard batches) - PLAYER missiles since M1, and X3 added
// the ENEMY arm (fireEnemyMissile + the player-hunting impact), so
// the exterior casters release through the one engine. Arrows stay
// host-side (EnemyAttack / the bow own them).
//
// deps:
//   renderer, audio           - batches + the cast/element sounds
//   getTexture, uploadRecord, uploadRecordFrame  - the missile billboard
//     mount and its animation frames (FA1); a host that passes no frame
//     uploader gets a still missile rather than a crash
//   collider                  - raycast for walls + touch LOS
//   playerEntity, playerSinks - the one player + its effect sinks
//   say(line)                 - the host's HUD text
//   surfacePlayer()           - the HUD vitals refresh
//   foes()                    - LIVE [{entity, ai, dead}] targets
//                               (dungeon foes / exterior guards / [])
//   foeSinks(f)               - the per-foe effect sinks
//   absorbCtx()               - { inside, day } read AT LANDING -
//                               DFU reads the player's surroundings
//                               per apply (EntityEffectManager :1305),
//                               so exteriors answer day/night live
//                               where the dungeon answers a constant.

import { FlatAnimator, armFlatAnim, MISSILE_FPS } from '../render/flatAnimation.js';   // FA1
import { effectiveLevel } from '../systems/mentorMode.js';   // SOFTCAP2: mentor mode - a mentor casts at the group's level
import { hasSpellbook } from '../systems/spellMaker.js';   // FIX-F: RecastSpell's book test (EntityEffectManager.cs:260)
const NO_SPELLBOOK_TEXT = 'You have no spellbook!';   // TextManager noSpellbook (Systems-Arc: the localized string, verbatim)
import {
  missileArchive, MISSILE_SPEED, MISSILE_COLLIDER_RADIUS, missileReach, missileHitsFoe,   // ROAD-H tail: the reach along the normalised direction; the foe's CAPSULE at contact
  MISSILE_LIFESPAN_S, EXPLOSION_RADIUS, BODY_CAPSULE_RADIUS, pickTouchTarget, sweepFoes, sphereOverlapsCapsule,   // ROAD-H H2: DoAreaOfEffect's OverlapSphere, against the player's capsule too
  missileHitsCapsule, PLAYER_BODY_RADIUS,   // AUDIT 62 F21 (review): the SphereCast contact test   // AUDIT 65 CV-2: the PLAYER's own controller radius (motor.js CAPSULE_RADIUS), not the foe's
} from '../systems/spellcast.js';
import { silenceBlocksCast, SILENCED_TEXT, PRESS_BUTTON_TO_FIRE_SPELL, DOOR_SPELL_TEXT, SOUL_TRAP_TEXT } from '../systems/mysticism.js';
import { calculateCastCost, effectSchool, EFFECT_COST_TABLE } from '../systems/spellcost.js';
import { applySpell, SPELL_REFLECTED_TEXT, hasActiveEffect, isSoulTrapEffect, spellSways } from '../systems/effects.js';   // WBX7: a soul trap meets the court's boss too
import { potionBundle } from '../systems/potions.js';   // U44: DrinkPotion's bundle
import { potentEffect } from '../net/alchemyLaw.js';   // PROF12: a Potent potion's magnitudes
import { SPELL_CAST_SOUND } from '../systems/enemySpells.js';
import { tallySkill } from '../systems/skills.js';
import { morphSelf } from '../systems/lycanthropy.js';   // V2a: the MorphSelf arm the ONE cast engine wires
import { allyCastable, allyReachFor, allyCastFrame, allyCastCasterLine, allyCastCasterLineMany, allyCastSpell, PERSON_RADIUS, ALLY_TOUCH_REACH, ALLY_ARM_RADIUS, ALLY_ARMED_LINE, COMPANION_ARMED_LINE, companionCastable, createGiftLineGate } from '../systems/allyCast.js';   // SPELL-GIFT: the arm near a mate, the line it says, and the area's one line; AUDIT WK-M4: what my companion can use
import { hasResurrect, RESURRECT_REACH, RESURRECT_TEXT, pickFallenBody } from '../systems/resurrect.js';   // RESURRECT1: a fallen party member's body is the target   // ALLY-CAST: a beneficial spell at the party mate under the crosshair
import { billboardSize, centredBase } from '../world/rmbFlats.js';
import { betterAmbience } from '../systems/betterAmbience.js';   // IMPACTFEEL: the camera kick a landing spell gives
import { SpellImpactFx, SpellImpactPass, elementFxKind, IMPACT_FX_KINDS } from '../render/spellImpactFx.js';
import { orbColourFrom } from '../characters/thunderlockIds.js';   // ART-COLOUR: a missile archive's own colour, the Thunderlock orb's sampler   // IMPACTFX: a landing spell in light - its element's spray, a heal's rising lines
import { createSpellImpactSounds } from '../systems/spellImpactSound.js';   // IMPACTFX: ...and heard
import { createMagicCandle } from './magicCandle.js';   // X11: the Light effect's candle
import { CAPSULE_HEIGHT } from '../player/motor.js';   // PlayerController.height, the candle's y term
import { setPlayerDoor } from '../systems/playerDoor.js';   // SET2: this host publishes itself as the scene a set's power reaches into
import { createHitEffects } from './hitEffects.js';   // AUDIT 26 F033: DaggerfallMissile's impact flash
import { duelSpellOf } from '../combat/duelCombat.js';   // DUEL1: the harmful half of a spell, which alone may reach a duel opponent
import { markPlayerHarm } from '../systems/harmMark.js';   // REVENANT-HARM: a foe's spell on the player leaves its mark (a death no blow names is its)
import { knockedDown } from '../systems/blowEffects.js';   // TELL6e: knocked down, no cast
import { sparedByPlayer, isShipmate, boutTeammates } from '../combat/friendlyFire.js';   // SHIPMATES: who the player's spells pass by, and whose blasts pass the player by
import { coverDistance, coverStep } from '../ai/cover.js';   // TACT1: billboards are cover; AUDIT TACT B5: met by touch
import { blowTaken } from '../systems/blowTaken.js';   // TELL1: what a spell's target takes (a staggered foe a quarter more)
import { noteFeudHarm, elementFeudClass } from '../systems/feudLedger.js';   // RVN1: my spell, in its fight's ledger (a leaf)
import { sandSpellRefusal } from '../systems/arenaKit.js';   // AUDIT ARENA-LADDER: the sand's kit law

/** SUNBABY2: a sky fireball (skyFire) is drawn this many times its flat's size, its flash too - a ball a sun throws,
 *  seen falling from far up - and heard this far (metres) from where it lands. */
export const SKY_FIRE_SCALE = 3;
export const SKY_FIRE_HEARD_M = 48;

/**
 * AUDIT SET M4: whether a burst from feet `a` reaches feet `b` through `collider` - chest to chest, a wall between is
 * the answer (the Warden's Nova is fire, not a thrown rock over a wall). No collider, or feet on feet: clear.
 * @param {any} collider @param {number[]} a @param {number[]} b
 */
export function burstClear(collider, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], d = Math.hypot(dx, dy, dz);
  if (!(d > 0.05)) return true;
  const eye = [a[0], a[1] + 1, a[2]], dir = [dx / d, dy / d, dz / d];
  return !(collider?.raycast?.(eye, dir, d) < d - 0.25);
}

export function createPlayerMagic({
  renderer, audio, getTexture, uploadRecord, uploadRecordFrame = null, collider,
  playerEntity, playerSinks, say, surfacePlayer,
  foes, foeSinks, absorbCtx,
  onTeleport = null,   // TP-slice: the Teleport effect's prompt seam (the host owns the box)
  onIdentify = null,   // X7: the Identify effect's window seam ({chance, refund}) - same shape as onTeleport
  onDispel = null,     // X9: the creature-dispel sweep seam ({group, chance}) - the host owns the scan and the pool
  onDispelMagic = null,// X10: the bundle-picker seam ({chance}) - the host owns the window
  onCreateItem = null, // X11b: the conjured-item picker seam ({rounds}) - the host owns the window
  now = null,          // V2a: the classic-minutes clock MorphSelf's once-a-day gate reads
  rolls = Math.random,   // ENGINE-PRNG RULE: the saving-throw/magnitude roll slot (uniform; sequence-free)
  // QG1: EntityEffectManager's two ready-spell events, the doors the
  // quest machine's CastSpellDo/CastEffectDo latches ride. NEW raises
  // in SetReadySpell right after `readySpell = spell` (:348); CAST
  // raises with the readied spell as it actually FIRES (:391/:2085/
  // :2130 - every release path), before the ready is cleared. An
  // ABORT raises neither - AbortReadySpell (:361-365) is silent,
  // which is precisely why the machine latches instead of polling.
  lairHere = null,     // RVN7 (bible/12-Enhanced-AI/Feud-Arc.md 18.1): where a revenant's deed is done here, for its lair (systems/playerDoor.js)
  isPuppet = null,     // AUDIT FEUD 2: the host's word on a foe another client runs (a dungeon room's carries no `puppet`)
  onNewReadySpell = null,
  onCastReadySpell = null,
  // ROAD-E6: THE HANDS, AND THE RELEASE FRAME THEY OWN.
  // EntityEffectManager.CastReadySpell (:430-435) does not resolve the
  // spell - it spends the magicka, calls
  // `PlayerSpellCasting.PlayOneShot(readySpell.Settings.ElementType)`
  // and sets castInProgress; five frames (0.2s) later
  // FPSSpellCasting's coroutine raises OnReleaseFrame and
  // PlayerSpellCasting_OnReleaseFrame (:2098-2143) is what tallies,
  // sounds, assigns/launches, raises OnCastReadySpell and clears the
  // ready. This dep is that PlayOneShot: the host hands it to its
  // weapon rig (`combat/weaponRig.js` castSpellAnim) and answers TRUE
  // when the hands actually started, which is when the resolution
  // parks on the release. A host with no rig - or an element with no
  // animation archive - answers false and the cast resolves HERE, on
  // the spot, which is DFU's own no-animation arm (CastNoAnimSpell
  // :367-398 and the non-player EnemyCastReadySpell branch at :436-439
  // both resolve inline, without ever touching FPSSpellCasting).
  // @type {?(sp:object, onRelease:Function) => boolean}
  startCastAnim = null,
  // ALLY-CAST (2026-09-23): the party mate under the crosshair within `reach`, as {id, name} or null - the host's own
  // pick (player/socialPick.js pickPeerInFront over its peers, party membership and the link's reach); and the door
  // the cast leaves through (online.sendCast), answering whether it went. A host with neither casts as before.
  allyTarget = null,
  castAtAlly = null,
  // RESURRECT1: the fallen party member's body under the crosshair ({id, acct, name, distance} or null), and the door
  // the call leaves through (the caster's party pose), answering whether it went
  fallenTarget = null,
  raiseFallen = null,
  // ALLY-CAST + AID1 (2026-09-23, the friendly-spells drop, integrated onto ALLY-CAST): THE PARTY MATES AS BODIES.
  // `allyMarks()` answers the party mates standing in this scene - [{id, name, feet, height}] in this host's own frame,
  // or null offline / on a relay that cannot carry the cast frame. The crosshair pick above still decides a cast at
  // its release; these are for what the pick cannot see - a beneficial touch that meets a mate, a beneficial missile
  // that strikes one, a beneficial blast they stand in. Each leaves through the SAME door (castAtAlly, the `cast`
  // frame), so the receiver's law is ALLY-CAST's: a party mate's gift alone, the beneficial families alone, as a
  // self-cast. A Fireball still passes through a friend: only an allyCastable spell ever considers a mate.
  allyMarks = null,
  // SPELLFX1: every player standing in this scene ([{id, feet, height}], the host's own frame) - for a peer's DRAWN
  // missile alone, which stops on any body it meets; nothing is ever given or dealt through this
  peerBodies = null,
  // DUEL1 (2026-09-24, Mac: duels - "Yes: weapons, bows, spells"): MY DUEL OPPONENT AS A BODY. `duelMark()` answers the
  // one player my harmful spells may reach - {id, name, feet, height} in this host's frame while a duel is fighting, null
  // otherwise - and `castAtDuel(id, spell)` is the door the blow leaves through (the duel's `spell` frame), answering
  // whether it went. A touch, a missile, a blast or an area that meets the opponent's body sends the spell's HARMFUL
  // families to them (combat/duelCombat.js duelSpellOf); their client applies it. Nobody else is ever a mark: a
  // Fireball still passes through every other player. AUDIT-SEATS G5: `duelMark()` may answer an ARRAY of such bodies -
  // a siege's foes, outside a duel (the host's door sends each to the battle's referee).
  duelMark = null,
  castAtDuel = null,
  // WB4b (2026-09-25, Mac: "a large boss arena with an oversized enemy"): THE BURNING COURT'S BOSS AS A BODY. `bossMark()`
  // answers him - {feet, height, radius} in this host's frame, his OWN radius (1.8: a touch, a missile and a blast meet
  // the whole of him) - while a fight stands, null otherwise; `castAtBoss(spell)` is the door a harmful spell that met
  // him leaves through (the host computes it against his stand-in and sends the number), answering whether it went.
  // Only a spell with a harmful family reaches him (duelSpellOf, the duel's own test of harm).
  bossMark = null,
  castAtBoss = null,
  crystalMarks = null,
  castAtCrystal = null,
  // WB11c: the Legion-Lord's host as marks a harmful spell meets (`hostMarks()` - each one standing, its number `i`, its
  // name, its body), and the door a spell that met one leaves through (`castAtHost(spell, i)`)
  hostMarks = null,
  castAtHost = null,
  // HOME-MAGIC (2026-09-27, Discord: "Players can use magic in player non owned houses"): THE HOST'S WORD ON THE PLACE -
  // a sentence refusing any cast where the player stands (a visitor in another's online home: worldModes.js
  // visitorMagicRefusal), or null. Asked at the ready, at the click (a spell readied outside is fired inside) and by an
  // item's cast; a host that hands none casts anywhere, as ever.
  castRefusal = null,
  // COMPANION-KIT (2026-10-01, Mac: "crew member companions need the ability to gain the players healing spells/buffs"):
  // MY COMPANIONS' BODIES in this scene (scenes/crewAshore.js - foe records, `rec.companion`), or none. A beneficial
  // spell (ALLY-CAST's own test, allyCastable) reaches them as it reaches a party mate - under the crosshair, by touch,
  // in a blast, struck by a missile - but lands HERE (they are mine to simulate), as a gift: ALLY-CAST's receiver's own
  // record (a self-cast, no save) tagged as an ally's bundle, through the foe's own sinks and never as my blow.
  companionBodies = null,
  // AUDIT-SEATS G5 (Seats-Arc 6.1: "Teleport, Recall and Levitate do nothing in a siege room"): THE HOST'S WORD ON THIS
  // SPELL HERE - a sentence refusing it where the player stands (a battle's wards: scenes/world.js), or null. Asked where
  // castRefusal is, with the spell, after it; a host that hands none refuses no spell for what it is.
  spellRefusal = null,
  // GIFT-QUIET: the clock a gift's lines are held back by, in ms - the real one (performance.now) unless a test hands one
  giftClockMs = undefined,
}) {
  const playerCaster = () => ({ entity: playerEntity, sinks: playerSinks });
  /** GIFT-QUIET (systems/allyCast.js GIFT_LINE_QUIET_S): a gift's line - an armed ready's, a caster's - said at most once
   *  in the window (createGiftLineGate); `fresh` says it whatever the window. */
  const giftGate = createGiftLineGate(giftClockMs);
  function sayGift(line, fresh = false) { if (line && giftGate(line, fresh)) say(line); }
  /** GIFT-QUIET (the 2026-10-04 audit): the arm the last ready took - 'mate-aim', 'mine-aim', 'mate-near', 'mine-near' -
   *  or null for a ready that armed none. An arm unlike the last one is said whatever the window: a heal that armed with
   *  my companion near, then fired on the spot once she stepped off, then armed again as she came back, said nothing,
   *  and the casting hands were the only sign it waited. */
  let _lastArm = null;
  function sayArm(kind, prev, ...lines) { _lastArm = kind; for (const l of lines) sayGift(l, prev !== kind); }
  /** HOME-MAGIC: the place's refusal SAID, and the ready dropped with it (the silence gate's own shape) - true when a
   *  cast is barred here. A host's seam that throws bars nothing. */
  function barredHere() {
    let why = null;
    try { why = castRefusal?.() ?? null; } catch { why = null; }
    if (!why) return false;
    readiedSpell = null; readiedFree = false; readiedCost = 0;
    say(why);
    return true;
  }
  /** AUDIT-SEATS G5: this SPELL refused where the player stands (spellRefusal), said, and the ready dropped with it -
   *  true when it is. A host's seam that throws refuses nothing. */
  function wardedHere(sp) {
    let why = null;
    try { why = spellRefusal?.(sp) ?? sandSpellRefusal(sp); } catch { why = null; }   // AUDIT ARENA-LADDER: and the sand's kit law, in every host (systems/arenaKit.js)
    if (!why) return false;
    readiedSpell = null; readiedFree = false; readiedCost = 0;
    say(why);
    return true;
  }
  // SET2: the door this engine publishes each frame it runs (systems/playerDoor.js). The foes are the ones MY harm may
  // reach (the town's defenders passed by, as my spells pass them); a hurt is my hurt through the foe's own sinks - its
  // pool's door, a kill mine and a puppet's hit its owner's - and a spell on me is a potion's (no save, no chance roll).
  let _doorFeet = null;
  const _door = Object.freeze({
    foes: () => playerTargets().filter((t) => t && !t.dead && t.entity),
    feet: () => _doorFeet,
    hurtFoe: (t, n) => { if (t && !t.dead && n > 0) foeSinks(t, true)?.hurt?.(Math.round(n), { fromPlayer: true }); },
    castOnPlayer: (bundle) => { if (bundle) applySpellToPlayer(bundle, effectiveLevel(playerEntity) ?? 1, null, { bypassSavingThrows: true, bypassChance: true }); },
    player: () => playerEntity,
    clear: (a, b) => burstClear(collider, a, b),   // AUDIT SET M4
    say: (line) => say?.(line),   // RVN3: a line the scene's HUD speaks (a revenant's weakness found, on the classic skin)
    sfx: (id, at) => audio?.play3d?.(id, at, 1, { maxDistance: 16 }),   // RVN3: a sound where a foe stands (its hiss)
    lairHere: () => { try { return lairHere?.() ?? null; } catch { return null; } },   // RVN7: the host's word on where a deed is done
    isPuppet: (f) => !!f?.puppet || (typeof isPuppet === 'function' && !!isPuppet(f)),   // AUDIT FEUD 2: run by another client - no deed of mine (a rout)
  });
  /** The party mates as foe-shaped marks ({ally, id, name, ai:{feet, height}}) - the shape every target helper in
   *  spellcast.js already reads - for a spell that may be given (allyCastable) and is not a FREE ready (AUDIT
   *  ALLY-CAST A7: a trap's payload is not a gift); [] for anything else, offline, or with no seam. */
  function allyMarksFor(sp, free = readiedFree) {
    if (!allyMarks || !castAtAlly || !sp || free || !allyCastable(sp)) return [];
    let list = null;
    try { list = allyMarks(sp) ?? null; } catch { return []; }   // SPELL-GIFT: the spell rides, so the host can add the strangers a stranger-castable one may reach
    if (!Array.isArray(list)) return [];
    const out = [];
    for (const q of list) {
      if (!q || typeof q.id !== 'string' || !Array.isArray(q.feet) || q.feet.length !== 3 || !q.feet.every(Number.isFinite)) continue;
      out.push({ ally: true, mate: q.mate !== false, id: q.id, name: q.name ?? 'a party member', dead: false, ai: { feet: q.feet, height: Number.isFinite(q.height) && q.height > 0 ? q.height : CAPSULE_HEIGHT } });   // AUDIT SPELL-GIFT B2: `mate`
    }
    return out;
  }
  /** COMPANION-KIT: my companions as foe-shaped marks ({companion, rec, name, ai}) for a spell that may be given and is
   *  not a free ready - ALLY-CAST's own gate; [] for anything else, or with no seam.
   *  AUDIT WK-M4: given to HIM - a gift carrying something he can use (allyCast.js companionCastable): a Light, a Detect or
   *  a Comprehend Languages alone is read off the player only, and armed for him it was spent on nothing.
   *  AUDIT WK-M6: never a man KNOCKED OUT - the pools' death arm holds him at 1 and marks him (`_knockedOut`), and he
   *  stands to the layer's next frame only to be carried aboard (crewAshore.js); a heal that frame was spent on a man
   *  already gone. */
  function companionMarksFor(sp, free = readiedFree) {
    if (!companionBodies || !sp || free || !companionCastable(sp)) return [];
    let list = null;
    try { list = companionBodies() ?? null; } catch { return []; }
    if (!Array.isArray(list)) return [];
    const out = [];
    for (const rec of list) {
      const f = rec?.ai?.feet;
      if (!rec || rec.dead || rec._knockedOut || !rec.entity || rec.puppet || !Array.isArray(f) || f.length !== 3 || !f.every(Number.isFinite)) continue;
      out.push({ companion: true, rec, name: rec.entity.name || 'your companion', dead: false, ai: { feet: f, height: Number.isFinite(rec.ai.height) && rec.ai.height > 0 ? rec.ai.height : CAPSULE_HEIGHT } });
    }
    return out;
  }
  /** COMPANION-KIT: a gift landed on my companion - applied here, ALLY-CAST's receiver's record (its beneficial effects as
   *  a self-cast: no save, the caster's level), tagged an ally's bundle (a buff on his bar and his card), through his own
   *  sinks as no blow of mine. Answers whether anything landed.
   *  AUDIT WK-M1: AND WITH NO CASTER, the receiver's own call (world.js online.onCast hands applySpellToPlayer `null`).
   *  Handed me as its caster, applySpell ran the incoming spell's chain (effects.js: absorption, REFLECTION, resistance -
   *  gated on a caster) that a gift never meets (AUDIT ALLY-CAST B6, C1): a companion wearing a Spell Reflection I gave
   *  him bounced my next heal onto me, and a Heal + Fortify landed on both of us, mine tagged an ally's.
   *  AUDIT WK-M4: what lands is what he can use (`companion`: the Light, Detect and Comprehend Languages stripped).
   *  AUDIT WK-M6: and never on a man knocked out. */
  function giveToCompanion(mark, sp, { quiet = false } = {}) {
    const rec = mark?.rec;
    if (!rec || rec.dead || rec._knockedOut || !rec.entity) return false;
    const gift = allyCastSpell({ name: sp?.name, element: sp?.element, effects: sp?.effects, icon: sp?.icon }, { companion: true });
    if (!gift) return false;
    applySpellToFoe(gift, effectiveLevel(playerEntity), rec, null, { allyCast: true }, foeSinks(rec, false));
    if (!quiet) sayGift(allyCastCasterLine(sp.name, mark.name));   // GIFT-QUIET
    return true;
  }
  /** COMPANION-KIT: a blast's gift to every companion in it - one line for all of them, as SPELL-GIFT's. */
  function giveToCompanions(marks, sp) {
    const names = [];
    for (const t of marks) if (giveToCompanion(t, sp, { quiet: true })) names.push(t.name);
    const line = allyCastCasterLineMany(sp.name, names);
    if (line) sayGift(line);   // GIFT-QUIET
    return names.length;
  }
  /** COMPANION-KIT: the companion the crosshair is on within `reach` - the aim passing within his body's radius of his
   *  axis, his own line of sight clear (a touch never crosses a wall); the nearest along the aim, or null. */
  function companionInReach(eye, dir, reach, sp = readiedSpell) {
    if (!eye || !dir || !(reach > 0)) return null;
    const l = Math.hypot(dir[0], dir[1], dir[2]) || 1, ux = dir[0] / l, uy = dir[1] / l, uz = dir[2] / l;
    let best = null, bestT = Infinity;
    for (const m of companionMarksFor(sp)) {
      const [x, y, z] = m.ai.feet;
      const t = (x - eye[0]) * ux + (z - eye[2]) * uz;   // along the aim, on the ground's plane
      const flat = Math.hypot(ux, uz);
      if (!(flat > 1e-6)) continue;
      const along = t / (flat * flat);   // the ray's own parameter at his axis
      if (!(along > 0) || along > reach) continue;
      const px = eye[0] + ux * along, py = eye[1] + uy * along, pz = eye[2] + uz * along;
      if (Math.hypot(px - x, pz - z) > PERSON_RADIUS + 0.15 || py < y - 0.2 || py > y + m.ai.height + 0.2) continue;
      if (along >= bestT) continue;
      const hit = collider.raycast(eye, [ux, uy, uz], along);
      if (Number.isFinite(hit) && hit < along - 1e-3) continue;
      best = m; bestT = along;
    }
    return best;
  }
  /** COMPANION-KIT: whether a companion the spell may be given to stands within ALLY_ARM_RADIUS of the caster's eye. */
  function companionNear(eye, sp) {
    if (!eye) return false;
    for (const m of companionMarksFor(sp)) {
      const [x, y, z] = m.ai.feet;
      const cy = Math.min(Math.max(eye[1], y), y + m.ai.height);
      const off = Math.hypot(eye[0] - x, eye[1] - cy, eye[2] - z);
      if (off <= ALLY_ARM_RADIUS) return true;
    }
    return false;
  }
  /** DUEL1: the duel opponent as a foe-shaped mark ({duel, id, name, ai:{feet, height}}) for a spell with a harmful
   *  family in it (duelSpellOf), a free ready's included (an enchanted item's strike is a duellist's too); [] for
   *  anything else, outside a fighting duel, or with no seam. */
  function duelMarksFor(sp) {
    if (!duelMark || !castAtDuel || !sp || !duelSpellOf(sp)) return [];
    let q = null;
    try { q = duelMark() ?? null; } catch { return []; }
    // AUDIT-SEATS G5: or several - a battle's foes (scenes/world.js), each through the same door
    const out = [];
    for (const m of Array.isArray(q) ? q : [q]) {
      if (!m || typeof m.id !== 'string' || !Array.isArray(m.feet) || m.feet.length !== 3 || !m.feet.every(Number.isFinite)) continue;
      out.push({ duel: true, id: m.id, name: m.name ?? 'your opponent', dead: false, ai: { feet: m.feet, height: Number.isFinite(m.height) && m.height > 0 ? m.height : CAPSULE_HEIGHT } });
    }
    return out;
  }
  /** WB4b: the court's boss as a foe-shaped mark ({boss, ai:{feet, height, radius}}) for a spell with a harmful family in
   *  it - WBX7: or a Soul Trap (Swololo on Discord: "soul trap didnt seem to work" - it passed straight through him); []
   *  for anything else, outside a fight, or with no seam. */
  function bossMarksFor(sp) {
    if (!bossMark || !castAtBoss || !sp || !(duelSpellOf(sp) || (sp.effects ?? []).some((e) => e && isSoulTrapEffect(e)) || spellSways(sp))) return [];   // WB8a: a Pacify or a Charm stops at him too - and is refused there
    const crystals = [...crystalMarksFor(sp), ...hostMarksFor(sp)];   // WB9c: the Reckoning's crystals meet a harmful spell as he does (a harmful one alone); WB11c: and his host
    let q = null;
    try { q = bossMark() ?? null; } catch { return crystals; }
    if (!q || !Array.isArray(q.feet) || q.feet.length !== 3 || !q.feet.every(Number.isFinite) || !(q.height > 0) || !(q.radius > 0)) return crystals;
    return [{ boss: true, name: q.name ?? '', dead: false, ai: { feet: q.feet, height: q.height, radius: q.radius } }, ...crystals];
  }
  /** WB9c: THE RECKONING'S CRYSTALS as foe-shaped marks for a spell with a harmful family - each carrying its number and
   *  the boss's door (`boss`, so a touch and a blast route them as they route him); [] otherwise. */
  function crystalMarksFor(sp) {
    if (!crystalMarks || !castAtCrystal || !sp || !duelSpellOf(sp)) return [];
    let list = null;
    try { list = crystalMarks() ?? null; } catch { return []; }
    if (!Array.isArray(list)) return [];
    return list.filter((q) => Number.isInteger(q?.c) && Array.isArray(q.feet) && q.feet.length === 3 && q.feet.every(Number.isFinite) && q.height > 0 && q.radius > 0)
      .map((q) => ({ boss: true, crystal: q.c, name: 'Crystal of Oblivion', dead: false, ai: { feet: q.feet, height: q.height, radius: q.radius } }));
  }
  /** WB11c: HIS HOST as foe-shaped marks for a spell with a harmful family - each its number and the boss's door (`boss`,
   *  so a touch and a blast route them as they route him and his crystals); [] otherwise. */
  function hostMarksFor(sp) {
    if (!hostMarks || !castAtHost || !sp || !duelSpellOf(sp)) return [];
    let list = null;
    try { list = hostMarks() ?? null; } catch { return []; }
    if (!Array.isArray(list)) return [];
    return list.filter((q) => Number.isInteger(q?.i) && Array.isArray(q.feet) && q.feet.length === 3 && q.feet.every(Number.isFinite) && q.height > 0 && q.radius > 0)
      .map((q) => ({ boss: true, host: q.i, name: q.name || 'Daedra', dead: false, ai: { feet: q.feet, height: q.height, radius: q.radius } }));
  }
  /** WB4b: a spell met him: out through the court's door. Nothing lands here - the relay holds his health. WB9c: or one
   *  of the Reckoning's crystals, by its number; WB11c: or one of his host, by its number. */
  function giveToBoss(mark, sp) {
    if (mark?.crystal != null) { try { return !!castAtCrystal?.(sp, mark.crystal); } catch { return false; } }
    if (mark?.host != null) { try { return !!castAtHost?.(sp, mark.host); } catch { return false; } }
    try { return !!castAtBoss?.(sp); } catch { return false; }
  }
  /** DUEL1: a blow landed on the opponent: out through the duel's door. Nothing lands here - their client resolves it. */
  function giveToDuel(mark, sp) {
    try { return !!castAtDuel?.(mark.id, sp); } catch { return false; }
  }
  /** A gift landed on a mate: out through ALLY-CAST's door, the caster's line on success. Nothing lands here - the
   *  mate's own client applies it (ALLY-CAST's receiver). */
  function giveToAlly(mark, sp, { quiet = false } = {}) {
    let sent = false;
    try { sent = !!castAtAlly?.(mark.id, allyCastFrame(sp, effectiveLevel(playerEntity), mark.id)); } catch { sent = false; }
    if (sent && !quiet) sayGift(allyCastCasterLine(sp.name, mark.name));   // GIFT-QUIET
    return sent;
  }
  /** SPELL-GIFT (Tabitha: "Area at Range & Area around Caster don't have good tooltips or UI elements"): a blast that
   *  reaches several mates is ONE line naming them all - it was a line per mate, a scroll of "You cast Heal on ..." */
  function giveToAllies(marks, sp) {
    const names = [];
    for (const t of marks) if (giveToAlly(t, sp, { quiet: true })) names.push(t.name);
    const line = allyCastCasterLineMany(sp.name, names);
    if (line) sayGift(line);   // GIFT-QUIET
    return names.length;
  }
  // Classic click-to-cast: DFU's armed state IS the readied spell -
  // EntityEffectManager.cs:250 fires on `readySpell != null`, and
  // CastReadySpell clears it. The port used to mirror that in a
  // separate one-shot latch, which could DESYNC from readiedSpell
  // (setReadiedByIndex set the spell and not the latch - found live
  // by the I2 cast probe). The latch is gone; armed derives.
  let pendingClickCast = false;
  let readiedSpell = null;
  let readiedFree = false;   // readySpellDoesNotCostSpellPoints (magic-8)
  // AUDIT 58: readySpellCastingCost (EntityEffectManager.cs:61). The
  // spell is PRICED ONCE, at the ready (:326-328
  // `readySpellCastingCost = spellPointCost;`), and CastReadySpell
  // spends THAT number (:423-425) - it never re-prices at the click.
  // The port used to recompute the cost inside castInput, so a skill
  // that moved during the ready window billed a different number from
  // the one quoted and gated at ready. Cleared wherever readiedSpell
  // is cleared, as DFU zeroes it at :342, :394, :2088 and :2141.
  let readiedCost = 0;
  // AUDIT 23 (magic-5): DFU's lastReadySpellCastingCost - set on every
  // player cast, read by the absorption refund cap when the player's
  // own spell lands back on them (EntityEffectManager.cs:600-604).
  let lastCastCost = 0;
  // ROAD-E6: castInProgress (EntityEffectManager.cs:59). True from the
  // magicka spend until the animation's release frame - the gate
  // SetReadySpell (:315) and CastReadySpell (:408) both refuse on, so
  // the 0.2s of hand motion is a window in which nothing can be
  // readied and nothing can be cast.
  let castInProgress = false;
  let lastSpell = null;   // FIX-F: EntityEffectManager's lastSpell (:2136) - what RecastSpell readies
  // ROAD-E6: the LIVE aim. DFU instantiates the missile at the release
  // frame from the caster's transform AT THAT MOMENT (the missile's
  // Start runs DoTouch/DoMissile on the frame it is spawned,
  // DaggerfallMissile.cs:265-286), so a player who turns during the
  // 0.2s fires along the new look. Every host already feeds this
  // engine its live eye/dir once a frame through firePending, so the
  // release reads that rather than the stale cast-time aim.
  let lastAim = null;
  const missiles = [];
  const flatAnims = new FlatAnimator();   // FA1: the missile flats
  const batches = [];
  // X11: THE MAGIC CANDLE, mounted here for the same reason the
  // missiles are - the Light effect belongs to the player, every host
  // that lets the player cast builds this engine, and the engine
  // already holds the three renderer deps a billboard needs. Riding
  // `batches` means all four hosts draw the candle with the line they
  // already have for missiles; only the LIGHT needs a per-host read,
  // because each host owns its own light array.
  const candle = createMagicCandle({
    renderer,
    getTexture,
    uploadRecord,
    onSpawn: (b) => batches.push(b),
    onRetire: (b) => { const i = batches.indexOf(b); if (i >= 0) batches.splice(i, 1); },
  });
  // PEERLIGHT2 (2026-09-26, the player: "can the candle spell of mages also make light for others?"): ANOTHER PLAYER'S
  // LIGHT SPELL - one candle mount per peer whose pose says the effect burns, the same mount mine is (the sprite, the
  // wobble, the light), hung off THEIR feet and heading. Keyed by peer id; a peer gone from the list drops its sprite.
  const peerCandleMounts = new Map();
  const _peerCandleLights = [];
  const mintPeerCandle = () => createMagicCandle({
    renderer, getTexture, uploadRecord,
    onSpawn: (b) => batches.push(b),
    onRetire: (b) => { const i = batches.indexOf(b); if (i >= 0) batches.splice(i, 1); },
  });

  // AUDIT 26 F033: the impact flash needs the same three renderer deps
  // the candle takes, and rides `batches` the same way.
  //
  // THE FRAME UPLOADER, not the record one: hitEffects uploads every
  // frame under the composite `${record}#${frame}` key and sets
  // `batch.frame = 0`, so the draw looks for `375_1#0`. Handed the
  // 2-arg `uploadRecord` it uploaded `375_1` instead and every impact
  // flash silently found no texture and drew nothing.
  const impacts = createHitEffects({
    renderer,
    getTexture,
    uploadRecordFrame,
    onSpawn: (b) => batches.push(b),
    onRetire: (b) => { const i = batches.indexOf(b); if (i >= 0) batches.splice(i, 1); },
  });
  // IMPACTFEEL: THE SPARK POOL - a few CHUNKS of the element's own art (flying flats, hitEffects.showFlyingFlat) thrown
  // under gravity beside the glow below: the pixel grain of the burst. Each lands on the ground found by a straight-down
  // cast from the impact (meshes AND terrain), bounces once, and dies at its lifespan.
  // n count | v outward speed | up extra upward speed | g gravity | bounce | life seconds | s size | fps
  const SPARK_KINDS = [
    { n: 4, v: 4.5, up: 4.5, g: 12, bounce: 0.35, life: 1.1, s: 0.30, fps: 14 },   // fire: hot, climbing, then drop
    { n: 3, v: 3.5, up: 3.0, g: 20, bounce: 0.15, life: 1.0, s: 0.34, fps: 8 },    // frost: shards, heavy, barely bounce
    { n: 3, v: 2.0, up: 2.0, g: 9,  bounce: 0.05, life: 1.4, s: 0.32, fps: 7 },    // poison / disease: slow lobs that splat
    { n: 4, v: 8.0, up: 2.5, g: 8, bounce: 0.5,  life: 0.7, s: 0.24, fps: 24 },    // shock: fast, wide, skittering
    { n: 4, v: 4.0, up: 3.5, g: 11, bounce: 0.3,  life: 1.1, s: 0.28, fps: 12 },   // magic
  ];
  const sparks = [];
  /** The floor's height under `pos` (meshes and terrain), or a body's height below it when the cast finds none. */
  function groundUnder(pos) {
    let ground = pos[1] - 1.2;
    try { const h = collider?.surfaceHit?.(pos, [0, -1, 0], 30) ?? null; if (h && Number.isFinite(h.dist)) ground = pos[1] - h.dist + 0.05; } catch { /* the guess stands */ }
    return ground > pos[1] ? pos[1] - 0.05 : ground;   // the impact is on the floor: it sprays above it
  }
  function spawnSparks(m, pos, sc, ground) {
    const k = SPARK_KINDS[Math.max(0, Math.min(4, m.spell.element | 0))];
    for (let i = 0; i < k.n; i++) {
      const a = Math.random() * Math.PI * 2, sp = k.v * (0.4 + Math.random() * 0.6);
      const h = impacts.showFlyingFlat(missileArchive(m.spell.element), pos, { record: 0, fps: k.fps * (0.8 + Math.random() * 0.4), scale: sc * k.s });
      sparks.push({ h, p: [pos[0], pos[1], pos[2]], v: [Math.cos(a) * sp, k.up * (0.3 + Math.random() * 0.7), Math.sin(a) * sp], k, ground, age: 0, life: k.life * (0.7 + Math.random() * 0.5), bounced: false });
    }
  }
  function stepSparks(dt) {
    const d = Math.min(dt, 0.05);
    for (let i = sparks.length - 1; i >= 0; i--) {
      const sp = sparks[i];
      sp.age += d;
      if (sp.age >= sp.life) { sp.h.retire(); sparks.splice(i, 1); continue; }
      sp.v[1] -= sp.k.g * d;
      sp.p[0] += sp.v[0] * d; sp.p[1] += sp.v[1] * d; sp.p[2] += sp.v[2] * d;
      if (sp.p[1] <= sp.ground) {
        sp.p[1] = sp.ground;
        if (!sp.bounced && sp.k.bounce > 0.1) { sp.v[1] = Math.abs(sp.v[1]) * sp.k.bounce; sp.v[0] *= 0.5; sp.v[2] *= 0.5; sp.bounced = true; }
        else { sp.v[0] = sp.v[1] = sp.v[2] = 0; }   // landed: it lies there till it goes out
      }
      sp.h.move(sp.p);
    }
  }
  /** IMPACTFX: the chunks go with a recenter (they were left behind in the first cut) and with a teardown. */
  function shiftSparks(o) { for (const sp of sparks) { sp.p[0] += o[0]; sp.p[1] += o[1]; sp.p[2] += o[2]; sp.ground += o[1]; } }
  function clearSparks() { for (const sp of sparks) sp.h.retire(); sparks.length = 0; }

  // IMPACTFX: THE LIGHT OF A LANDING (render/spellImpactFx.js) and ITS SOUND (systems/spellImpactSound.js). The pass is
  // built on the first frame there is something to draw and drawn by the hosts right after this engine's billboards
  // (drawFx); a pass that will not build leaves the classic flash and the chunks exactly as they were.
  const fx = new SpellImpactFx();
  let fxPass = null, fxBroken = false;
  const impactSounds = createSpellImpactSounds(audio);
  // ART-COLOUR: EACH ELEMENT'S BURST WEARS ITS OWN ART'S COLOUR. Once per element, the first time a missile of it flies
  // or lands, its archive (375-379, missileArchive) is asked for (it is warm by then: the missile itself draws from it)
  // and its impact flash's first frame - record 1, what the burst is drawn over - sampled the Thunderlock orb's way.
  // Its flight record 0 answers if the flash has no colour in it. Until then the burst wears its first guess.
  const _artAsked = new Set();
  function noteElementArt(el) {
    if (!Number.isInteger(el) || el < 0 || el > 4 || _artAsked.has(el) || typeof getTexture !== 'function') return;
    _artAsked.add(el);
    Promise.resolve().then(() => getTexture(missileArchive(el))).then((t) => {
      if (!t?.getColor32 || !t?.getDFBitmap) return;
      const sample = (rec) => { try { return (t.recordCount == null || rec < t.recordCount) ? orbColourFrom(t.getColor32(t.getDFBitmap(rec, 0), 0)) : null; } catch { return null; } };
      const c = sample(1) ?? sample(0);
      if (c) fx.setArtColour(elementFxKind(el), c);
    }).catch(() => { /* the first guess stands */ });
  }
  /** A heal's look: every effect a gift (allyCastable) and one of them a Heal (10) or a Regenerate (18). */
  const HEAL_FX_TYPES = new Set([10, 18]);
  function fxKindOf(spell) {
    if (!spell) return 'magic';
    try { if (allyCastable(spell) && (spell.effects ?? []).some((e) => e && HEAL_FX_TYPES.has(e.type))) return 'heal'; } catch { /* its element's, then */ }
    return elementFxKind(spell.element);
  }
  /** One landing, seen and heard: the burst at `pos` over the floor under it, its sound, and - for anything but a heal
   *  - the camera's kick falling off over 14 m (`shake` the kick at the player's feet). */
  /** AOE-REACH: the body an area's drawn reach is measured for - the sweep's own default foe (sweepFoes, sphereOverlapsCapsule). */
  const AREA_FX_BODY = Object.freeze({ r: BODY_CAPSULE_RADIUS, h: 1.8 });
  function landFx(kind, pos, { back = null, scale = 1, power = 1, radius = null, minR = 0, heard = 40, shake = 0, ground = null, area = 0, areaFrom = null, normal = null, surfaceAt = null } = {}) {
    try {
      if (kind !== 'heal') noteElementArt(IMPACT_FX_KINDS.indexOf(kind));   // ART-COLOUR: a touch or a peer's lands here first sometimes
      const gy = Number.isFinite(ground) ? ground : groundUnder(pos);
      fx.burst(kind, pos, { ground: gy, back, scale, power, radius, minR, area, areaFrom, body: AREA_FX_BODY, normal, surfaceAt });   // AOE-SIZE / AOE-REACH: an area's burst is drawn to what its sweep catches
      impactSounds.play(kind, kind === 'heal' ? [pos[0], gy + 1, pos[2]] : pos, { heard, volume: kind === 'heal' ? 0.8 : Math.min(1, 0.75 + 0.2 * power) });   // HEAL-SOFT: a big heal is no louder
      const f = _doorFeet;
      if (shake > 0 && kind !== 'heal' && f) {
        const d = Math.hypot(pos[0] - f[0], pos[1] - f[1], pos[2] - f[2]);
        const k = Math.max(0, 1 - d / 14) * shake;
        if (k > 0.15) betterAmbience.weaponKick(k);
      }
      return gy;
    } catch { return null; }   // feel is never worth a crash
  }
  /** A body's middle, for a touch that met it (its feet and height, a person's when it states none). */
  const bodyMid = (t) => (t?.ai?.feet ? [t.ai.feet[0], t.ai.feet[1] + (t.ai.height ?? 1.8) * 0.55, t.ai.feet[2]] : null);
  /** Where a mate under the crosshair stands: `distance` along the aim. */
  const alongAim = (eye, dir, d) => { const l = Math.hypot(dir[0], dir[1], dir[2]) || 1; return [eye[0] + (dir[0] / l) * d, eye[1] + (dir[1] / l) * d, eye[2] + (dir[2] / l) * d]; };
  /** A gift that landed on someone (a mate, my companion, a foe touched with a heal) - a heal rises at their feet. */
  function giftFx(sp, at) {
    if (!at || fxKindOf(sp) !== 'heal') return;
    landFx('heal', at, { radius: 0.75, heard: 24 });
  }
  /** DaggerfallMissile.DoCollision (:364-370) - record 1 of the
   *  missile's own element archive, one-shot at 15fps, gated on
   *  `elementType != None && targetType != ByTouch` (rangeType 1). */
  function showImpactFlash(m, pos) {
    if (!m.spell || m.spell.element == null || m.spell.rangeType === 1) return;
    impacts.showImpactFlash(missileArchive(m.spell.element), pos, m.scale ?? 1);   // SUNBABY2: a sky fireball's, at its own size
    // IMPACTFEEL: the impact reads heavier - a larger, slower bloom behind the classic flash, a few chunks of the
    // element's own art, and (IMPACTFX) the burst in light: the element's spray thrown back off what it struck and down
    // onto the floor, its rings and its light, its sound, and the camera's kick (blasts harder; the player's maxShake /
    // shake-off rule it, betterAmbience.weaponKick). All additive: the classic flash above is untouched.
    try {
      const sc = m.scale ?? 1;
      const kind = fxKindOf(m.spell);
      const ground = groundUnder(pos);
      if (kind !== 'heal') {
        impacts.showMissEffect('spell', pos, { archive: missileArchive(m.spell.element), record: 1, fps: 12, scale: sc * 1.8 });
        spawnSparks(m, pos, sc, ground);
      }
      const dl = Array.isArray(m.dir) ? Math.hypot(m.dir[0], m.dir[1], m.dir[2]) : 0;
      const back = dl > 1e-6 ? [-m.dir[0] / dl, -m.dir[1] / dl, -m.dir[2] / dl] : null;
      // WALL-RING: WHAT IT STRUCK - the surface along the line of flight just through the impact (a wall, a ceiling, the
      // floor), its normal turned to face the shot. None (a body, the air): the burst finds its own plane.
      let normal = null, surfaceAt = null;
      if (back && collider?.surfaceHit) {
        try {
          const u = [-back[0], -back[1], -back[2]], from = [pos[0] - u[0] * 0.6, pos[1] - u[1] * 0.6, pos[2] - u[2] * 0.6];
          const h = collider.surfaceHit(from, u, 1.3);
          if (h && Number.isFinite(h.dist) && Array.isArray(h.normal) && h.normal.every(Number.isFinite)) {
            const nd = h.normal[0] * u[0] + h.normal[1] * u[1] + h.normal[2] * u[2];
            normal = nd > 0 ? [-h.normal[0], -h.normal[1], -h.normal[2]] : [...h.normal];
            surfaceAt = [from[0] + u[0] * h.dist, from[1] + u[1] * h.dist, from[2] + u[2] * h.dist];
          }
        } catch { /* the burst finds its own plane */ }
      }
      const blast = m.spell.rangeType === 4;
      // AOE-SIZE: an Area at Range blast is drawn to the sphere explodeAt sweeps (EXPLOSION_RADIUS about the impact); a
      // single-target bolt keeps its own smaller burst
      landFx(kind, kind === 'heal' ? [pos[0], ground, pos[2]] : pos, { back, ground, scale: sc, power: blast ? 1.25 : 1, radius: 0.8,
        area: blast ? EXPLOSION_RADIUS : 0, areaFrom: blast ? pos : null, heard: m.sky ? SKY_FIRE_HEARD_M : 40, shake: blast ? 4.5 : 3,
        normal: kind === 'heal' ? null : normal, surfaceAt });   // WALL-RING: the shockwave lies on what it struck
    } catch { /* feel is never worth a crash */ }
    // SUNBABY2: and a sky fireball is HEARD where it lands - its element's cast clip (DFU has no impact clip; the
    // missile's sound is its cast's), from the impact, as far as SKY_FIRE_HEARD_M
    if (m.sky) { try { audio.play3dId?.(SPELL_CAST_SOUND[m.spell.element] ?? SPELL_CAST_SOUND[4], pos, 1, { maxDistance: SKY_FIRE_HEARD_M }); } catch { /* a sound never costs the flash */ } }
  }

  /** Every spell landing ON THE PLAYER rides this: the S19 Paralyze
   *  awakeAlert ("You are paralyzed.", once per new instance) fires
   *  for player hosts only, exactly like DFU's StartParalyzation. */
  // X5: every spell the PLAYER lands on a foe goes through here, so
  // the one message a foe-targeted effect owes the player's HUD gets
  // spoken once and in one place. DFU's SoulTrap.BecomeIncumbent calls
  // DaggerfallUI.AddHUDText directly (SoulTrap.cs:86) - a global UI
  // call, so it reaches the player even though the effect lives on the
  // monster. The foe's own sinks carry no `say` and should not: the
  // line belongs to the caster, not the target.
  // AUDIT 68 S21-strike-landing-dup: `sinks` is the one override - the enchantment door (hostEnchant's
  // applySpellToTarget) lands through HERE with its own membership-routed sinks, where it kept a copy of this
  // landing that dropped the Soul Trap line and the Calm/Charm flag.
  function applySpellToFoe(spell, casterLevel, foe, caster = null, ctx = undefined, sinks = foeSinks(foe, !caster || caster.entity === playerEntity)) {   // AUDIT WORLD2 B7: a foe's spell is not the player's blow (AUDIT 68 X4: every host's sinks read the second arg)
    // REVENANT-FATE (the 2026-10-02 audit): one held by its fate - kneeling, burning, gathering into a portal - takes no
    // spell: its blow was already refused (the kill door), and a Wabbajack, a paralysis or a drain landed all the same
    if (foe?.yielded || foe?.executing || foe?.sparing || foe?.leaving || foe?.roaring) return null;   // RVN4: nor one roaring its last stand
    // TELL1 (bible/12-Enhanced-AI/Feud-Arc.md 3.2): the landing's damage through what the TARGET takes (a staggered foe a
    // quarter more - systems/blowTaken.js, the formulas' tail's law for a spell); a kill and a later round as they come
    const striker = caster?.entity ?? playerEntity;
    // RVN1 (Feud-Arc.md section 12): MY spell's landing goes in the fight's ledger by its element (a later round is
    // systems/effects.js's to write - the round sink's own law); a peer's (its stand-in caster) and a foe's never
    const mine = striker === playerEntity;
    const landing = sinks?.hurt ? { ...sinks, hurt: (n, o) => {
      const d = o?.whole || o?.round ? n : blowTaken(n, striker, foe.entity, null, { kind: 'spell', element: spell?.element ?? null });
      if (mine && !o?.round) noteFeudHarm(foe.entity, elementFeudClass(spell?.element), d);
      return sinks.hurt(d, { ...(o ?? {}), element: spell?.element ?? null });   // RVN3: the element rides to the door (its weakness's weight)
    } } : sinks;
    const r = applySpell(spell, casterLevel, foe.entity, landing, rolls, caster, ctx);
    // STRIKE-SHARED (2026-09-29): ANOTHER PLAYER'S strike spell, landed here on the foe I own (`ctx.peerCaster` its id).
    // The trap's line is its caster's and not mine to speak, and a new trap is marked with whose it is - its soul goes
    // to that caster's pack, never mine (mysticism.js peerSoulTrapOf). An incumbent trap keeps its own caster, as it
    // keeps its own chance (AddState stacks rounds alone).
    const peerCaster = typeof ctx?.peerCaster === 'string' ? ctx.peerCaster : null;
    if (r.trapAlert && !peerCaster) say(SOUL_TRAP_TEXT[r.trapAlert]);
    if (peerCaster && r.trapAlert === 'trapActive') {
      const trap = (foe.entity.activeEffects ?? []).find((a) => a.kind === 'soulTrap' && !a.ended);
      if (trap) trap.by = peerCaster;
    }
    // X8: PACIFY / CHARM. The effect answers whether the target was
    // pacified; the AI flag lives on the foe RECORD rather than the
    // entity, so this door - the one place that holds both - is where
    // it lands. Permanent by design: nothing expires it, and the
    // damage doors restore hostility when the player attacks
    // (MakeEnemyHostileToAttacker), which is classic's own
    // "until player attacks them".
    if (r.pacify && foe.ai && !foe.entity?.pacifyImmune) foe.ai.isHostile = false;   // WB8a: never the gate's Warden
    // X11: SPELL REFLECTION - the FOE is the reflector here, so no HUD
    // line (TryReflection's "Spell was reflected." is gated on
    // `IsPlayerEntity` on the REFLECTING manager, EEM:1231-1233), and
    // the bundle goes back at whoever cast it. This function is DFU's
    // `casterEffectManager.AssignBundle(sourceBundle)`: the seam that
    // holds both parties, which is why the re-target lives here and
    // not inside the effect module.
    if (r.reflected && caster?.entity && !peerCaster) {   // STRIKE-SHARED: a peer's caster is not in this world - its stand-in has no body to take the bundle back
      const back = { ...(ctx ?? {}), reflectedCount: 1 };
      if (caster.entity === playerEntity) applySpellToPlayer(spell, casterLevel, caster, back);
      else applySpell(spell, casterLevel, caster.entity, caster.sinks ?? {}, rolls, caster, back);
    }
    return r;
  }

  function applySpellToPlayer(spell, casterLevel, caster = null, extraCtx = null) {
    // S24: the absorption context, read from the HOST at landing.
    const base = absorbCtx();
    // V2a: MorphSelf's arm - the ONE cast engine wires it once, so a
    // Lycanthropy cast in any host reaches the racial override.
    base.morphSelf = () => morphSelf(playerEntity, { nowMinutes: now ? Math.floor(now()) : 0, say });
    const ctx = { ...(lastCastCost > 0 ? { ...base, selfCastCost: lastCastCost } : base), ...(extraCtx ?? {}) };
    if (caster?.entity && caster.entity !== playerEntity && !caster.entity.isPlayer) markPlayerHarm(caster.entity);   // REVENANT-HARM: before it lands - its burn may be the death
    const r = applySpell(spell, casterLevel, playerEntity, playerSinks, rolls, caster, ctx);
    if (r.paralyzed) say('You are paralyzed.');
    // S19c: AssignBundle's failure messages, player hosts only -
    // CasterOnly chance fails say "Spell effect failed.", external
    // contact fails and full saves say "Save versus spell made."
    if (r.chanceFailed) say(spell.rangeType === 0 ? 'Spell effect failed.' : 'Save versus spell made.');
    if (r.saved) say('Save versus spell made.');
    // X3: the ARMED half of Open/Lock. Neither effect does anything at
    // cast - it waits in forcedRoundsRemaining for a door - so this
    // line is the ONLY sign the spell worked, and DFU speaks it from
    // StartWaitingForDoor gated on "the host manager is player"
    // (Open.cs:93-97, Lock.cs:84-89). applySpellToPlayer IS that gate:
    // a foe host runs applySpell directly and stays silent. The alert
    // repeats on a recast (awakeAlert is per-INSTANCE, and the merged
    // instance still runs its own Start), which is why it hangs off
    // the arm rather than off the incumbent being new.
    if (r.armed) say(r.armed === 'openArmed' ? DOOR_SPELL_TEXT.readyToOpen : DOOR_SPELL_TEXT.readyToLock);
    // TP-slice: a landed Teleport effect prompts (Teleport.cs Start
    // :63-68); the marker only rises on CasterOnly arrivals and this
    // is the PLAYER seam - :88-90's player gate, structurally.
    if (r.teleport) onTeleport?.();
    // X7: the Identify effect opens a window rather than landing. The
    // REFUND happens here, at the one place that charged the cast:
    // Identify.cs:50-56 gives back its own spell point cost (floored
    // at 5) because the real magicka is spent on the window's own
    // Identify click. A host with no window seam still gets the
    // refund - the player is not charged for a window that never
    // opened, which is the same shape as DFU refunding first and
    // opening second.
    // X9: DISPEL UNDEAD / DAEDRA. Self-targeted, so it lands here on
    // the caster and sweeps the area around them. The host owns both
    // the nearby scan and the foe pool the destroy acts on, so the
    // whole sweep goes out through one seam.
    if (r.dispel) onDispel?.(r.dispel);
    // X10: DISPEL MAGIC opens a picker over the player's own live
    // bundles. No refund here, unlike Identify - DFU charges the cast
    // even if the popup is cancelled, "confirmed in classic".
    if (r.dispelMagic) onDispelMagic?.(r.dispelMagic);
    if (r.identify) {
      playerEntity.magicka = Math.min(playerEntity.maxMagicka ?? Infinity,
        (playerEntity.magicka ?? 0) + r.identify.refund);
      surfacePlayer();
      onIdentify?.(r.identify);
    }
    // X11b: CREATE ITEM opens a list picker and mints from the pick.
    // Like Dispel Magic and unlike Identify, there is NO refund: the
    // effect has no cost of its own to give back, and DFU's picker
    // cannot be cancelled anyway (AllowCancel = false), so the cast is
    // always spent on something.
    if (r.createItem) onCreateItem?.(r.createItem);
    // X11: the PLAYER is the reflector, so the line IS spoken here -
    // and the bundle goes back at the caster's own manager, which
    // re-runs their absorb/reflect/resist chain on arrival. The caster
    // is a foe (a self-cast never reaches the reflect gate: caster ===
    // target), so its arrival needs no HUD arms and goes through
    // applySpell directly.
    if (r.reflected) {
      say(SPELL_REFLECTED_TEXT);
      if (caster?.entity && caster.entity !== playerEntity) {
        applySpell(spell, casterLevel, caster.entity, caster.sinks ?? {}, rolls, caster,
          { ...(extraCtx ?? {}), reflectedCount: 1 });
      }
    }
    return r;
  }

  // Cast ranges II: the rangeType-4 EXPLOSION - indiscriminate sweep
  // (OverlapSphere at impact): every live foe within the radius, and
  // the player when close enough. L2-slice (AUDIT 23 magic-9):
  // excludeFoe carries the enemy AreaAroundCaster's ignoreCaster -
  // DFU's caster-position AoE skips the caster itself
  // (DoAreaOfEffect(position, true), DaggerfallMissile.cs:477-495).
  /** The caster wrapper a missile carries: the player's for the player's, the foe's (its entity and sinks) for an
   *  enemy's, none for an enemy missile whose caster is gone. */
  const missileCaster = (m) => (m.fromPlayer === false ? (m.casterFoe ? { entity: m.casterFoe.entity, sinks: foeSinks(m.casterFoe), foe: m.casterFoe } : null) : playerCaster());
  /** DISC19-F (AUDIT DISC19): THE TOWN'S DEFENDERS TAKE NONE OF THE
   *  PLAYER'S SPELLS - not the blast, the area, the missile or the
   *  touch. The port's own rule, beside the swing's friendly protection
   *  (cityGuards.resolvePlayerHit): a Fireball at the centaur the watch
   *  is fighting struck the watch too, and a blow on a defender is
   *  Assault - the mage who meant to help was made the criminal. A
   *  defender is a watch record's own flag (cityGuards.js); a monster's
   *  spell still lands on one. SHIPMATES: the player's own crew too -
   *  one law with the shaft's and the swing's (combat/friendlyFire.js). */
  const sparedFromPlayer = (t) => sparedByPlayer(t);
  const playerTargets = () => foes().filter((t) => !sparedFromPlayer(t));
  /** AREA-CASTER (FIELD BUGS 2026-10-01; asked, Mac: "Include the caster"): AN AREA SPELL MADE ONLY OF GIFTS LANDS ON ITS
   *  CASTER TOO - an Area Around Caster's (DFU's ignoreCaster passed them by) and an Area at Range's wherever its missile
   *  bursts, or if it bursts nowhere - as a self-cast, never saved against (ALLY-CAST C1's law for a gift), once, at the
   *  cast: the burst passes its caster by (explodeAt). A spell with harm in it is DFU's: its caster only where its blast
   *  reaches them, and saved against. */
  function giveAreaToCaster(sp) {
    if (!allyCastable(sp)) return;
    const r = applySpellToPlayer({ ...sp, rangeType: 0 }, effectiveLevel(playerEntity), playerCaster());
    if (r.healed > 0) say(`You are healed ${r.healed} points.`);
  }
  function explodeAt(pos, spell, casterLevel, playerFeet, caster = null, { excludeFoe = null, playerHeight = CAPSULE_HEIGHT, allies = false, duel = false, boss = duel } = {}) {
    // SHIPMATES: a blast of the player's own crew passes the player and the rest of the crew by (combat/friendlyFire.js)
    const crewBlast = isShipmate(caster?.foe);
    for (const t of sweepFoes(pos, EXPLOSION_RADIUS, foes())) {
      if (excludeFoe && t === excludeFoe) continue;
      if (caster?.entity === playerEntity && sparedFromPlayer(t)) continue;   // DISC19-F (AUDIT DISC19): my blast passes the defenders by
      if (crewBlast && isShipmate(t)) continue;
      if (caster?.foe && boutTeammates(caster.foe, t)) continue;   // ARENA-TEAMS: a bout fighter's blast passes its teammate by
      if (t.puppet && caster?.entity && caster.entity !== playerEntity) continue;   // AUDIT WORLD6b-iii(a) C15: a FOE's blast lands nothing on a PUPPET here - its owner's world resolves that foe (my own blast on a puppet still goes to its owner as my hit)
      applySpellToFoe(spell, casterLevel, t, caster);
    }
    // AID1 onto ALLY-CAST: MY OWN beneficial blast reaches the party mates in it too (DoAreaOfEffect's OverlapSphere meets
    // their colliders) - `allies` is the missile's own word that it may be given (not a free ready)
    if (allies && caster?.entity === playerEntity) giveToAllies(sweepFoes(pos, EXPLOSION_RADIUS, allyMarksFor(spell, false)), spell);   // SPELL-GIFT: one line for all of them
    if (allies && caster?.entity === playerEntity) giveToCompanions(sweepFoes(pos, EXPLOSION_RADIUS, companionMarksFor(spell, false)), spell);   // COMPANION-KIT: and my companions in it
    // DUEL1: and MY blast reaches my duel opponent standing in it (`duel`: the missile's own word it is mine)
    if (duel && caster?.entity === playerEntity) for (const t of sweepFoes(pos, EXPLOSION_RADIUS, duelMarksFor(spell))) giveToDuel(t, spell);
    // WB4b: and the court's boss, whose flank is in it (his own radius)
    if (boss && caster?.entity === playerEntity) for (const t of sweepFoes(pos, EXPLOSION_RADIUS, bossMarksFor(spell))) giveToBoss(t, spell);   // AUDIT WBX F5: `boss` - a Soul Trap is no duel spell, and it meets him too
    // ROAD-H H2: the player is a COLLIDER in DFU's OverlapSphere like every foe (DaggerfallMissile.cs:481) - its CharacterController capsule, at the LIVE height PlayerHeightChanger keeps (:54-57/:475-478). This measured ONE POINT at the STANDING half-capsule, feet + 0.9: a metre and a half wrong on a mount, half a metre wrong crouched, and short of DFU's catch by a whole body radius in every stance. AUDIT 65 CV-2: and that body is the PLAYER's 0.35 (PlayerAdvanced.prefab:82), not the foe's 0.45 - the rim is 4.35.
    if (playerFeet && !crewBlast && sphereOverlapsCapsule(pos, EXPLOSION_RADIUS, playerFeet, playerHeight, PLAYER_BODY_RADIUS)) {
      // AREA-SELF (FIELD BUGS 2026-10-01, Opaldes: "Big Regen Spell doesnt do anything" - Area at Range, Regenerate and
      // Fortify): MY OWN BLAST OF GIFTS IS NEVER SAVED AGAINST BY ME - DFU save-scales every bundle that is not
      // CasterOnly, so its caster resisted their own Regenerate round by round (two rounds in three for a Breton) and
      // their own Fortify at the landing. AREA-CASTER: it landed on me at the cast, as a self-cast (giveAreaToCaster),
      // so the burst passes me by. A blast that is not all gifts (allyCastable), and a foe's, are saved against as before.
      const gift = caster?.entity === playerEntity && allyCastable(spell);
      if (!gift) applySpellToPlayer(spell, casterLevel, caster);
    }
  }

  // AUDIT 23 (magic-4) - EntityEffectManager.cs:2106-2108: "Always
  // tally magic skills when player physically casts a spell" -
  // TallyPlayerReadySpellEffectSkills (:1964-1978) tallies each real
  // effect's MagicSkill by 1. Unknown classic keys tally nothing
  // (DFU's effect != null gate), so the cost table's presence is the
  // gate, not effectSchool's priced-as-Destruction default.
  // AUDIT 23 (magic-13): the same release moment plays the element's
  // cast sound at the player.
  function tallyCastSkills(sp) {
    for (const e of sp.effects) {
      if (e.type < 0) continue;
      if (!EFFECT_COST_TABLE[`${e.type},${e.subType & 0xff}`]) continue;
      tallySkill(playerEntity, effectSchool(e), 1);
    }
    // AUDIT 58: the ID door - PlayCastSound's `(uint)castSoundID`
    // (EntityEffectManager.cs:1958 -> DaggerfallAudioSource.cs:232-238)
    audio.playOneShotId(SPELL_CAST_SOUND[sp.element] ?? SPELL_CAST_SOUND[4], 1);
  }

  /** ByTouch's target pick - the 0.25-radius sphere-cast 3.0 ALONG THE
   *  AIM with an LOS check (L2-slice magic-7). DFU runs it TWICE for
   *  one cast: once as CastReadySpell's pre-spend gate
   *  (GetEntityTargetInTouchRange, :411-421) and once for real when the
   *  ByTouch missile's Start calls DoTouch on the release frame
   *  (DaggerfallMissile.cs:273-275). Both reads live here. */
  function pickTouch(eye, dir, sp = null) {
    if (!eye || !dir) return null;
    const marks = [...allyMarksFor(sp), ...duelMarksFor(sp), ...bossMarksFor(sp)];   // AID1 onto ALLY-CAST: a beneficial touch may land on a party mate - the nearest along the aim wins; DUEL1: a harmful one on my duel opponent; WB4b: or on the court's boss
    marks.push(...companionMarksFor(sp));   // COMPANION-KIT: or on my companion
    return pickTouchTarget(eye, dir, marks.length ? [...playerTargets(), ...marks] : playerTargets(), (c, d) => {   // DISC19-F (AUDIT DISC19): my touch meets no defender
      const l = d || 1, dx = (c[0] - eye[0]) / l, dy = (c[1] - eye[1]) / l, dz = (c[2] - eye[2]) / l;
      const hit = collider.raycast(eye, [dx, dy, dz], d);
      return !Number.isFinite(hit) || hit >= d - 1e-3;
    });
  }

  /** AUDIT ALLY-CAST A2/A6: THE PARTY MATE THE CAST WOULD LAND ON - the host's pick (`allyTarget`: the F key's ray
   *  over the party, within `reach`, a member some socket of mine reaches) behind pickTouch's OWN line-of-sight rule:
   *  the first cut redirected a Heal at a friend through a closed door or a dungeon wall, which a touch on a foe
   *  never crosses. Null with no aim, no pick, a wall short of them, or a pick that throws (the host's seam, not the
   *  cast's law - the spell then goes the ordinary way). The plaque asks the same question (A5), so it never promises
   *  a cast the click would not make. */
  /** RESURRECT1: the fallen party member's body the cast would raise - the host's pick behind the touch's own
   *  line-of-sight rule, exactly as allyInReach. */
  function fallenInReach(eye, dir) {
    if (!eye || !dir || !fallenTarget) return null;
    // RESURRECT2: the host hands the fallen party members' bodies in reach; the pick is a LYING body's - where the
    // crosshair meets the floor, or a crosshair passing over the body - through this engine's own collider, so the
    // floor the aim lands on is the target's, never a wall in front of it
    let bodies = null;
    try { bodies = fallenTarget(eye, dir, RESURRECT_REACH) ?? null; } catch { return null; }
    if (!Array.isArray(bodies) || !bodies.length) return null;
    const l = Math.hypot(dir[0], dir[1], dir[2]) || 1;
    const ground = collider.raycast(eye, [dir[0] / l, dir[1] / l, dir[2] / l], RESURRECT_REACH * 2);
    return pickFallenBody(eye, dir, bodies, Number.isFinite(ground) ? ground : Infinity);
  }
  function allyInReach(eye, dir, reach, sp = readiedSpell) {
    if (!eye || !dir || !allyTarget) return null;
    let ally = null;
    try { ally = allyTarget(eye, dir, reach, sp) ?? null; } catch { return null; }   // SPELL-GIFT: the spell rides, as allyMarks's does
    if (!ally) return null;
    const d = ally.distance;
    if (Number.isFinite(d) && d > 0) {
      const l = Math.hypot(dir[0], dir[1], dir[2]) || 1;
      const hit = collider.raycast(eye, [dir[0] / l, dir[1] / l, dir[2] / l], d);
      if (Number.isFinite(hit) && hit < d - 1e-3) return null;
    }
    return ally;
  }

  /** SPELL-GIFT: whether any mate the spell may be given to stands within ALLY_ARM_RADIUS of the caster's eye - the
   *  marks' own feet (the same bodies a touch or a blast would meet), measured to the nearest point of their capsule's
   *  axis. AUDIT SPELL-GIFT B2: A MATE - a stranger near armed every online player's self-buff in a town, party or none,
   *  and told them to "aim at a party member"; a stranger is given one by aiming at them (allyInReach, above). */
  function allyNear(eye, sp) {
    if (!eye) return false;
    for (const m of allyMarksFor(sp)) {
      if (!m.mate) continue;
      const [x, y, z] = m.ai.feet;
      const top = y + (m.ai.height ?? CAPSULE_HEIGHT);
      const cy = Math.min(Math.max(eye[1], y), top);
      if (Math.hypot(eye[0] - x, eye[1] - cy, eye[2] - z) <= ALLY_ARM_RADIUS) return true;
    }
    return false;
  }

  /**
   * ROAD-E6: PlayerSpellCasting_OnReleaseFrame (:2098-2143) - the four
   * range arms, each recording the refund-cap cost, tallying, and
   * firing. THE SPEND IS NOT HERE: DecreaseMagicka runs at the cast
   * (:423-425), five frames earlier.
   *
   * The `p` record carries the cost DFU keeps in readySpellCastingCost;
   * the SPELL is re-read off `readiedSpell` because that is what DFU's
   * handler reads (:2102), and it is the field an AbortReadySpell
   * (:361-365) during the 0.2s nulls - a cancelled spell reaches the
   * `return` and DFU's own comment at :2107 says so ("Cancelled spells
   * do not reach this point"). The magicka is NOT refunded: it was
   * spent at the cast and nothing gives it back.
   *
   * DEATH during the window is not a gate in DFU either. Update()
   * returns early once IsPlayingGame() is false, but OnReleaseFrame is
   * an event off FPSSpellCasting's own coroutine, so the spell still
   * leaves the hands of a player who died mid-motion. A PAUSE does stop
   * it: PauseGame zeroes Time.timeScale (GameManager.cs:606-607) and
   * WaitForSeconds is scaled, so the coroutine holds - which this port
   * gets for free, because a modal host returns before its rig's
   * frame() and nothing steps the animation.
   */
  function releaseFrame(p) {
    castInProgress = false;   // :2100, the handler's first line
    const sp = readiedSpell;
    if (!sp) return false;    // :2102-2104 "Must have a ready spell"
    const cost = p.cost;
    // The live aim (see lastAim); the cast-time aim is the fallback for
    // an engine no host frame has fed yet.
    const eye = lastAim ? lastAim.eye : p.eye;
    const dir = lastAim ? lastAim.dir : p.dir;
    // :2141 - readySpellDoesNotCostSpellPoints clears with the ready.
    const done = (v) => { lastSpell = sp; onCastReadySpell?.(sp); readiedSpell = null; readiedFree = false; readiedCost = 0; return v; };   // :2136-2141 (lastSpell = readySpell, the raise, then the clear)
    // ALLY-CAST: THE PARTY MATE UNDER THE CROSSHAIR takes a beneficial CasterOnly, ByTouch or SingleTargetAtRange
    // cast - the port's own targeting (systems/allyCast.js, a recorded departure): a CasterOnly Heal read off a
    // friend is a touch on them, not on me. The spell is spent as any cast is (the magicka went at the cast, the
    // tally is the same), and the ally's own client applies it. A frame that cannot leave (nobody reachable) falls
    // through to the ordinary arm: the spell still does what it always did. AUDIT ALLY-CAST A7: a FREE ready (a
    // trap's payload, readySpellDoesNotCostSpellPoints) is never redirected - it is the trap's spell on the player who
    // sprang it, not a gift they chose to give.
    // RESURRECT1: a Resurrect goes to the fallen body it was cast at (the gate below the cast refused one with no body
    // before a point was spent), whatever its range type; the fallen player's own client does the rising
    if (hasResurrect(sp) && !readiedFree) {
      const f = fallenInReach(eye, dir);
      lastCastCost = cost;
      tallyCastSkills(sp);
      surfacePlayer();
      let sent = false;
      try { sent = !!(f && raiseFallen?.(f)); } catch { sent = false; }
      say(sent ? RESURRECT_TEXT.cast(f.name) : RESURRECT_TEXT.noBody);
      return done(true);
    }
    const allyReach = allyReachFor(sp.rangeType);
    const ally = !readiedFree && allyReach !== null && allyCastable(sp) ? allyInReach(eye, dir, allyReach) : null;
    if (ally && castAtAlly?.(ally.id, allyCastFrame(sp, effectiveLevel(playerEntity), ally.id))) {
      lastCastCost = cost;
      tallyCastSkills(sp);
      surfacePlayer();
      sayGift(allyCastCasterLine(sp.name, ally.name));   // GIFT-QUIET
      if (Number.isFinite(ally.distance)) giftFx(sp, alongAim(eye, dir, ally.distance));   // IMPACTFX: a heal rising at the mate
      return done(true);
    }
    // COMPANION-KIT: ...or MY COMPANION under the crosshair - the same reach, given here
    const mine = !readiedFree && allyReach !== null && allyCastable(sp) ? companionInReach(eye, dir, allyReach) : null;
    if (mine) {
      lastCastCost = cost;
      tallyCastSkills(sp);
      surfacePlayer();
      giveToCompanion(mine, sp);
      giftFx(sp, bodyMid(mine));   // IMPACTFX
      return done(true);
    }
    if (sp.rangeType === 0) {
      // S7: CasterOnly applies to SELF (Balyna's Balm heals) - no
      // missile; AssignBundle at :2117.
      tallyCastSkills(sp);
      const r = applySpellToPlayer(sp, effectiveLevel(playerEntity), playerCaster());
      // AUDIT 24 scenes: PlayerSpellCasting_OnReleaseFrame assigns the
      // CasterOnly bundle at :2117 and only stamps
      // `lastReadySpellCastingCost = readySpellCastingCost` at :2138 -
      // AFTER it. So AssignBundle's absorption cap (:603, gated on
      // `lastReadySpellCastingCost > 0`) reads the PREVIOUS player
      // cast's cost, not this one's; on the session's first self-cast
      // the gate fails outright and nothing is capped.
      lastCastCost = cost;
      if (r.healed > 0) say(`You are healed ${r.healed} points.`);
      if (eye && fxKindOf(sp) === 'heal') landFx('heal', [eye[0], eye[1], eye[2]], { radius: 1.0, minR: 0.45, heard: 24 });   // IMPACTFX: it rises about me - clear of my own eye (a CasterOnly needs no aim: readied before any frame fed one, it heals and draws nothing)
      surfacePlayer();
      return done(true);
    }
    if (sp.rangeType === 1) {
      // The ByTouch missile's own DoTouch, on the release frame.
      const t = pickTouch(eye, dir, sp);
      lastCastCost = cost;
      tallyCastSkills(sp);
      surfacePlayer();
      // Nothing in reach when the hands open: the spell is spent and
      // gone, exactly as DFU's touch missile that finds no entity.
      if (t?.ally) giveToAlly(t, sp);   // AID1 onto ALLY-CAST: the touch met a mate the crosshair pick did not name
      else if (t?.companion) giveToCompanion(t, sp);   // COMPANION-KIT: the touch met my companion
      else if (t?.duel) giveToDuel(t, sp);   // DUEL1: the touch met my duel opponent
      else if (t?.boss) giveToBoss(t, sp);   // WB4b: the touch met the court's boss
      else if (t) applySpellToFoe(sp, effectiveLevel(playerEntity), t, playerCaster());
      // IMPACTFX: the touch, seen where it met - a heal rising at whoever took it, the element's small spray on a foe
      if (t) {
        const mid = bodyMid(t) ?? alongAim(eye, dir, 1.5), kind = fxKindOf(sp);
        if (kind === 'heal') landFx('heal', mid, { radius: 0.75, heard: 24 });
        else landFx(kind, mid, { scale: 0.75, power: 0.6, heard: 30, shake: 1.5 });
      }
      return done(true);
    }
    if (sp.rangeType === 3) {
      // AreaAroundCaster: every live foe within the explosion radius.
      lastCastCost = cost;
      tallyCastSkills(sp);
      surfacePlayer();
      for (const t of sweepFoes(eye, EXPLOSION_RADIUS, playerTargets())) {   // DISC19-F (AUDIT DISC19): nor my area
        applySpellToFoe(sp, effectiveLevel(playerEntity), t, playerCaster());
      }
      giveToAllies(sweepFoes(eye, EXPLOSION_RADIUS, allyMarksFor(sp)), sp);   // AID1 onto ALLY-CAST: the mates around me - SPELL-GIFT: one line for all of them
      giveToCompanions(sweepFoes(eye, EXPLOSION_RADIUS, companionMarksFor(sp)), sp);   // COMPANION-KIT: and my companions
      for (const t of sweepFoes(eye, EXPLOSION_RADIUS, duelMarksFor(sp))) giveToDuel(t, sp);   // DUEL1: and my duel opponent, if they stand in it
      for (const t of sweepFoes(eye, EXPLOSION_RADIUS, bossMarksFor(sp))) giveToBoss(t, sp);   // WB4b: and the court's boss, if any of him stands in it
      giveAreaToCaster(sp);   // AREA-CASTER: and me, when it is all gifts
      // IMPACTFX: the area seen going off about me - a heal's wide ring of rising light, or the element's nova on the floor
      // AOE-SIZE: drawn to the sphere the sweep above catches - EXPLOSION_RADIUS about my EYE, so its rim on the floor
      // is where a foe stops being caught
      { const kind = fxKindOf(sp), at = [eye[0], eye[1] - 1, eye[2]];
        if (kind === 'heal') landFx('heal', at, { area: EXPLOSION_RADIUS, areaFrom: eye, minR: 0.5, heard: 30 });
        else landFx(kind, at, { power: 1.2, area: EXPLOSION_RADIUS, areaFrom: eye, heard: 40, shake: 3 }); }
      return done(true);
    }
    if (sp.rangeType !== 2 && sp.rangeType !== 4) return done(false);
    lastCastCost = cost;
    tallyCastSkills(sp);
    surfacePlayer();
    missiles.push({ spell: sp, pos: [eye[0], eye[1], eye[2]], dir: [...dir], age: 0, batch: null, fromPlayer: true, ally: !readiedFree && allyCastable(sp), duel: !!duelSpellOf(sp), boss: !!duelSpellOf(sp) || (sp.effects ?? []).some((e) => e && isSoulTrapEffect(e)) || spellSways(sp) });   // AID1 onto ALLY-CAST: may be given to a party mate it strikes (never a free ready's); DUEL1: may strike my duel opponent; AUDIT WBX F5: may meet the court's boss - a harmful spell, or a Soul Trap (at range or bursting, as by touch)
    if (sp.rangeType === 4) giveAreaToCaster(sp);   // AREA-CASTER: an Area at Range spell of gifts lands on me too, wherever it bursts
    return done(true);
  }

  /**
   * CastReadySpell (:400-439), verbatim ORDER: the silence gate, the
   * ready/castInProgress gate, the touch-range gate, DecreaseMagicka,
   * and then PlayOneShot - which is where the cast STOPS. What used to
   * be the whole of this function is now releaseFrame() above, parked
   * on the animation five frames (0.2s) later.
   */
  function castInput(eye, dir) {
    const sp = readiedSpell;
    if (!sp) return false;
    if (knockedDown()) return false;   // TELL6e: knocked down - the spell stays readied, no cast
    if (barredHere()) return false;   // HOME-MAGIC: a spell readied outside is not fired inside another's home
    if (wardedHere(sp)) return false;   // AUDIT-SEATS G5: a spell readied before a battle is not fired in its wards
    // S27 / SilenceCheck (EntityEffectManager :1932-1946). DFU tests
    // this at CAST as well as at ready, and BOTH clear the readied
    // spell - a silence landing mid-aim disarms you rather than
    // waiting for the click. L2-slice (magic-8): a FREE ready (a
    // trap's CasterOnly payload) bypasses the gate, exactly as :404
    // gates SilenceCheck on !readySpellDoesNotCostSpellPoints.
    if (!readiedFree && silenceBlocksCast(playerEntity)) {
      readiedSpell = null;
      readiedCost = 0;
      say(SILENCED_TEXT);
      return false;
    }
    // :408 - "a previous cast must not be in progress". The hands own
    // the 0.2s and a second click inside it does nothing at all.
    if (castInProgress) return false;
    // AUDIT 58: the cost is the one CAPTURED AT READY, not a fresh
    // pricing. CastReadySpell has exactly THREE gates - SilenceCheck
    // (:403-405), the ready/castInProgress pair (:407-409) and the
    // ByTouch range probe (:411-421) - and then spends
    // readySpellCastingCost unconditionally (:423-425). There is no
    // magicka test at the cast: the ONLY sufficiency gate in the file
    // is SetReadySpell's (:337-343), whose own comment says
    // "Daggerfall does this when setting ready spell". The port had a
    // fourth gate here that silently ate the click when magicka fell
    // between the ready and the click; DFU fires and clamps instead.
    const cost = readiedFree ? 0 : readiedCost;   // S10: the per-effect skill-scaled cost; free readies spend nothing
    // RESURRECT1: nothing is spent on a Resurrect with no fallen party member under the crosshair
    const raising = hasResurrect(sp) && !readiedFree;
    if (raising && !fallenInReach(eye, dir)) { say(RESURRECT_TEXT.noBody); return false; }
    // AUDIT CONTRIB A1: a Resurrect's touch IS the body - the gate above found one in reach, and the probe below sees
    // only foes and standing mates, so a Resurrect at a body with no foe beside it was eaten silently here
    if (sp.rangeType === 1 && !raising) {
      // ByTouch: CastReadySpell aborts BEFORE spending when no target
      // sits in touch range (verbatim - the S9 'spends on a whiff'
      // rule was wrong and died at its audit).
      // ALLY-CAST: the touch probe admits a party mate in touch reach as it admits a foe - the release frame (the
      // ally arm there) is where the cast is aimed, but CastReadySpell's own gate runs first
      // AUDIT WK-M2: and MY COMPANION by the release frame's own pick (companionInReach - the aim anywhere along his
      // height, the gate's twin of the mate's). pickTouch's sphere meets a body at its centre point alone, so a level aim
      // at his face was refused here - nothing spent, the spell still readied - while the release would have given it him
      if (!pickTouch(eye, dir, sp) && !(!readiedFree && allyCastable(sp) && (allyInReach(eye, dir, ALLY_TOUCH_REACH) || companionInReach(eye, dir, ALLY_TOUCH_REACH)))) return false;   // AID1 onto ALLY-CAST: a mate's body the touch meets is a target too
    }
    // :423-425 DecreaseMagicka - the spend is at the CAST, before a
    // single frame of hand motion has run.
    // DecreaseMagicka -> SetMagicka clamps at 0 (DaggerfallEntity.cs:374-381
    // `Mathf.Clamp(amount, 0, MaxMagicka)`), it never refuses the cast.
    playerEntity.magicka = Math.max(0, (playerEntity.magicka ?? 0) - cost);
    const parked = { cost, eye: eye ? [...eye] : null, dir: dir ? [...dir] : null };
    // :430-435 - the player's arm plays the animation and blocks
    // further casting until it releases.
    if (startCastAnim && startCastAnim(sp, () => releaseFrame(parked))) {
      castInProgress = true;
      return true;
    }
    // :436-439 - no animation, so the release is now.
    return releaseFrame(parked);
  }

  /** The spellbook's ready hook - DFU's SetReadySpell laws in order:
   *  the silence gate (S27), the cost gate with the classic refusal
   *  (AUDIT 23 magic-14, :337-343), the assignment, and the instant
   *  CasterOnly cast (:350-351). L2-slice (AUDIT 23 magic-8): `free`
   *  is SetReadySpell's noSpellPointCost - a trap's CasterOnly spell
   *  readies ON THE PLAYER for free, BYPASSING the silence gate
   *  (:315 gates SilenceCheck on !noSpellPointCost) and the cost.
   *  Answers as SetReadySpell does (AUDIT CONTRIB H3): true when the spell
   *  is in hand or cast, false when a gate refused it. */
  function readySpell(sp, { free = false } = {}) {
    const prevArm = _lastArm; _lastArm = null;   // GIFT-QUIET: a ready that arms nothing ends the arm
    if (barredHere()) return false;   // HOME-MAGIC: before every other gate, a free ready's too (an item's spell)
    if (wardedHere(sp)) return false;   // AUDIT-SEATS G5: a battle's wards, before it costs anything
    if (!free && silenceBlocksCast(playerEntity)) { readiedSpell = null; readiedCost = 0; say(SILENCED_TEXT); return false; }
    // ROAD-E6: :315's second term - "Do nothing if silenced OR CAST
    // ALREADY IN PROGRESS". Nothing can be readied while the hands are
    // in motion, and unlike the silence arm this one does NOT clear the
    // spell already readied: DFU returns false before touching a field.
    if (castInProgress) return false;
    // :326-328 - CalculateTotalEffectCosts runs ONCE, here, and the
    // number is STORED in readySpellCastingCost. Every later reader
    // (the :337 gate, the :423-425 spend) reads the stored number.
    const spellPointCost = free ? 0 : calculateCastCost(sp, playerEntity).sp;
    if (!free && (playerEntity.magicka ?? 0) < spellPointCost) {
      readiedSpell = null;
      readiedCost = 0;   // :341-342
      say("You don't have the spell points.");   // youDontHaveTheSpellPoints
      return false;
    }
    readiedSpell = sp;
    readiedFree = free;
    readiedCost = spellPointCost;
    onNewReadySpell?.(sp);   // :348 - after the assignment, before the CasterOnly instant cast
    if (sp.rangeType === 0) {
      // AUDIT ALLY-CAST A1: a CasterOnly spell with a PARTY MATE under the crosshair ARMS instead of firing on the
      // spot. The instant arm (:350-351) gave the player no sign of where the cast would land - a Heal readied while
      // a friend happened to stand in the way went to them, a Heal readied for a friend who had just stepped aside
      // healed me - so the port's own targeting (systems/allyCast.js) shows itself first: armed, the plaque under
      // the mate says "Cast Heal on Bran", and the next click resolves through releaseFrame's ally arm, or through
      // the CasterOnly arm as ever if they moved. A free ready (A7) fires on the spot as DFU's does; so does one
      // with nobody there.
      if (!free && allyCastable(sp) && allyInReach(lastAim?.eye ?? null, lastAim?.dir ?? null, ALLY_TOUCH_REACH, sp)) { sayArm('mate-aim', prevArm, PRESS_BUTTON_TO_FIRE_SPELL); return true; }
      // COMPANION-KIT: a CasterOnly gift ARMS with my companion under the crosshair, or near - the two arms of ALLY-CAST
      // here for a body of mine (companionMarksFor holds a free ready and a spell not his to him): the click gives it to
      // him, or, aimed anywhere else, to me.
      // AUDIT WK-M9: IN THE CLICK'S OWN ORDER - releaseFrame asks the mate under the crosshair first, then my companion -
      // and both crosshair arms before either near arm. My companion's two used to stand ahead of all of ALLY-CAST's, so a
      // ready with a mate under the crosshair and my companion near said "Aim at your companion..." and the click gave it
      // to the mate; with a mate near as well, the near line is the mate's (ALLY_ARMED_LINE).
      if (companionInReach(lastAim?.eye ?? null, lastAim?.dir ?? null, ALLY_TOUCH_REACH, sp)) { sayArm('mine-aim', prevArm, PRESS_BUTTON_TO_FIRE_SPELL); return true; }
      // SPELL-GIFT (2026-09-27, Tabitha: "a LARGE amount of buffs & spells just don't work when cast on another person"):
      // ...AND WITH A MATE NEAR, not only one already under the crosshair (systems/allyCast.js ALLY_ARM_RADIUS). Readied
      // first and aimed after - the way anyone casts - the buff had gone off on the caster on the spot. Armed, the click
      // gives it to the mate under the crosshair, or, aimed anywhere else, to the caster, as CasterOnly always does.
      if (!free && allyCastable(sp) && allyNear(lastAim?.eye ?? null, sp)) { sayArm('mate-near', prevArm, PRESS_BUTTON_TO_FIRE_SPELL, ALLY_ARMED_LINE); return true; }
      if (companionNear(lastAim?.eye ?? null, sp)) { sayArm('mine-near', prevArm, PRESS_BUTTON_TO_FIRE_SPELL, COMPANION_ARMED_LINE); return true; }
      if (!free && hasResurrect(sp)) { say(fallenInReach(lastAim?.eye ?? null, lastAim?.dir ?? null) ? PRESS_BUTTON_TO_FIRE_SPELL : RESURRECT_TEXT.aim); return true; }   // RESURRECT1: a caster-only Resurrect waits for the click, aimed at the body
      return castInput(null, null) !== false;
    }
    // AUDIT 24 scenes: SetReadySpell's own line, verbatim -
    // GetLocalizedText("pressButtonToFireSpell") = "Press button to
    // fire spell." (Internal_Strings_en, EntityEffectManager.cs:355).
    say(PRESS_BUTTON_TO_FIRE_SPELL);   // classic: the next attack-click CASTS
    return true;
  }

  async function ensureMissileBatch(m) {
    if (m.batch !== null) return;
    m.batch = false;   // in-flight guard
    const archive = missileArchive(m.spell.element);
    const t = await getTexture(archive);
    if (!t) return;
    // The arrow's bug, twice more: this is async and `m.batch = false`
    // is the in-flight guard, so a missile that retires while its
    // texture warms leaves retireMissile's splice nothing to find -
    // and then the microtask pushes a batch for a DEAD missile that
    // nothing ever removes, drawn at its fire position for the rest of
    // the scene. Check before publishing.
    if (m.dead) { m.batch = null; return; }
    uploadRecord(archive, 0);
    const own = billboardSize(t, 0);
    const size = m.scale ? { ...own, w: own.w * m.scale, h: own.h * m.scale } : own;   // SUNBABY2: a sky fireball is drawn larger
    m.firePos = [...m.pos];
    m.batch = renderer.createBillboardBatch(archive, 0, size, [centredBase(m.firePos, size)]);   // FIELD-GUN20: a missile is CENTRED on its position (DaggerfallMissile.cs:601-602, no AlignToBase) - the base is half a height under it
    // FA1 slice 2: the missile flat ANIMATES while it flies -
    // DaggerfallMissile.cs:605 sets BillboardFramesPerSecond (5) on the
    // billboard it makes at :601. Frozen on frame 0, a fireball was a
    // photograph of a fireball.
    armFlatAnim(m.batch, t, archive, 0, flatAnims, uploadRecordFrame, { fps: MISSILE_FPS });
    batches.push(m.batch);
  }

  function retireMissile(m) {
    if (m.batch) {
      flatAnims.remove(m.batch);   // FA1
      const bi = batches.indexOf(m.batch);
      if (bi >= 0) batches.splice(bi, 1);
      renderer.destroyBillboardBatch(m.batch);
    }
    m.dead = true;
  }

  /** PLAYER spell missile flight: lifespan, the wall raycast (an
   *  AreaAtRange payload explodes AT THE IMPACT POINT - AUDIT 23
   *  magic-2, DaggerfallMissile.cs:399-402), advance, and the
   *  mid-capsule foe contact (rangeType 4 explodes, 2 applies). */
  function update(dt, playerFeet, forward = null, playerHeight = CAPSULE_HEIGHT, renderFeet = null) {
    // SET2: THIS host is the scene now - its live foes, my feet in its frame, and its own doors for a hurt and a spell
    // (systems/playerDoor.js: what a set's power reaches past the one blow through)
    _doorFeet = playerFeet ?? null;
    setPlayerDoor(_door);
    stepSparks(dt);   // IMPACTFEEL (after the door: SET2 publishes it first thing each frame): the chunks' flight
    fx.step(dt);      // IMPACTFX: the light's
    for (const m of missiles) if (!m.dead && m.spell && !m._artNoted) { m._artNoted = true; noteElementArt(m.spell.element); }   // ART-COLOUR: sampled while it flies, so its landing wears it
    // FA1: the missile flats' clock rides the module's OWN update, not
    // each host's frame - hostMagic is shared by three of them and a
    // per-host tick is the four-hosts shape waiting to happen.
    flatAnims.tick(dt);
    impacts.tick(dt);   // F033
    // X11: the candle, same reasoning. A host that passes no forward
    // gets a candle straight in front of the world's +Z rather than a
    // crash, and that is visible enough to be reported rather than
    // quietly wrong.
    candle.update(dt, {
      active: hasActiveEffect(playerEntity, 'light'),
      feet: renderFeet ?? playerFeet ?? [0, 0, 0],   // DISC13-A: the candle hangs off the RENDER feet (motor.js feetAt), as the camera does - the stepped feet slid it against the view every frame on a screen faster than 60 Hz
      height: playerHeight,
      forward,
    });
    for (const m of missiles) {
      if (m.dead) continue;
      ensureMissileBatch(m);
      m.age += dt;
      if (m.age > MISSILE_LIFESPAN_S) { retireMissile(m); continue; }
      const step = MISSILE_SPEED * dt;
      const { unit: _unit, reach } = missileReach(m.dir, step);   // ROAD-H tail: DaggerfallMissile.cs:333/:337-339's reach along the normalised direction
      // TACT1: cover stops a bolt, and an area spell bursts on it; AUDIT TACT B5: by touch, the bodies before it tested first
      const _len = Math.hypot(m.dir[0], m.dir[1], m.dir[2]) || 1;
      const _cs = coverStep(coverDistance(collider, m.pos, _unit, reach), collider.raycast(m.pos, _unit, reach), reach, reach - step * _len, step * _len);
      const hitWall = _cs.stop;
      if (Number.isFinite(hitWall) && hitWall <= reach) {
        const impact = [m.pos[0] + _unit[0] * hitWall, m.pos[1] + _unit[1] * hitWall, m.pos[2] + _unit[2] * hitWall];   // ROAD-H tail (review): the collider answers in the RAY's own units, and the ray is `_unit` - `m.dir` would scale the impact point by |dir| (`colliderPosition += direction.normalized * hitInfo.distance`, DaggerfallMissile.cs:347)
        if (m.spell.rangeType === 4 && !m.visual) {   // SPELLFX1: a peer's DRAWN missile lands nothing
          // AUDIT WORLD6b-iii(a) A1: an ENEMY missile's blast on a wall is the ENEMY's - its caster's level and sinks
          // (the flight's own arm below had them); this arm credited every enemy blast to ME at MY level, with the
          // reflect chain and the skill tallies mine to pay
          explodeAt(impact, m.spell, m.fromPlayer === false ? (m.casterLevel ?? 1) : effectiveLevel(playerEntity), playerFeet, missileCaster(m), { playerHeight, allies: !!m.ally, duel: !!m.duel, boss: m.boss ?? !!m.duel });   // ROAD-H H2: the blast's OverlapSphere meets the player's LIVE capsule
        }
        showImpactFlash(m, impact);   // F033: DFU flashes on ANY wall hit, AoE or not
        retireMissile(m);
        continue;
      }
      const _adv = step * _cs.advance;   // AUDIT TACT B5: no further than cover's touch
      m.pos[0] += m.dir[0] * _adv; m.pos[1] += m.dir[1] * _adv; m.pos[2] += m.dir[2] * _adv;
      // The batch was built ONCE at the fire position; flight rides
      // the batch's origin uniform (zero GL churn).
      if (m.batch) m.batch.origin = [m.pos[0] - m.firePos[0], m.pos[1] - m.firePos[1], m.pos[2] - m.firePos[2]];
      // SPELLFX1: A PEER'S MISSILE, DRAWN - it flies, meets a wall (above), a body or me, flashes and is gone, and
      // applies NOTHING: the caster's own world decided what it hit (a beneficial one of theirs reached its target as ALLY-CAST's cast frame)
      if (m.visual) {
        // SUNBABY2: a sky fireball lands where it was thrown - on the ground the host found under it, which the
        // collider's ray (buildings, not the terrain) would not stop it at
        if (m.sky) {
          m.left -= _adv * _len;
          if (m.left <= 0) { showImpactFlash(m, m.to); retireMissile(m); continue; }
        }
        const body = (playerFeet && missileHitsCapsule(m.pos, playerFeet, playerHeight, PLAYER_BODY_RADIUS))
          || foes().some((f) => !f.dead && missileHitsFoe(m.pos, f))
          || (peerBodies?.() ?? []).some((q) => q && q.id !== m.casterId && Array.isArray(q.feet) && missileHitsCapsule(m.pos, q.feet, q.height ?? CAPSULE_HEIGHT, PLAYER_BODY_RADIUS));
        if (body) { showImpactFlash(m, [m.pos[0], m.pos[1], m.pos[2]]); retireMissile(m); }
        continue;
      }
      // X3-slice: an ENEMY missile hunts the PLAYER (the dungeon's
      // arm: the caster wrapper rides the impact; foe-vs-foe
      // friendly fire pends the target sweep, the shared residual).
      if (m.fromPlayer === false) {
        if (playerFeet && !isShipmate(m.casterFoe)) {   // SHIPMATES: a crewman's missile flies past the player
          // AUDIT 62 F21 (review): the player's CAPSULE, DaggerfallMissile
          // .cs:339's SphereCast into its CharacterController, at the LIVE
          // height - the shared engine's copy of the dungeon's arm.
          if (missileHitsCapsule(m.pos, playerFeet, playerHeight, PLAYER_BODY_RADIUS)) {
            const mCaster = missileCaster(m);
            if (m.spell.rangeType === 4) explodeAt(m.pos, m.spell, m.casterLevel ?? 1, playerFeet, mCaster, { playerHeight });   // ROAD-H H2
            else applySpellToPlayer(m.spell, m.casterLevel ?? 1, mCaster);
            showImpactFlash(m, [m.pos[0], m.pos[1], m.pos[2]]);   // F033
            retireMissile(m);
          }
        }
        continue;
      }
      // AID1 onto ALLY-CAST: a BENEFICIAL missile of mine meets a party mate's capsule the way it meets a foe's
      // (DaggerfallMissile's SphereCast hits whatever collider is there) - an AreaAtRange one bursts, the rest are given
      // to that mate alone
      if (m.ally) {
        // COMPANION-KIT: my companion's body meets it as a mate's does
        const hitMate = [...allyMarksFor(m.spell, false), ...companionMarksFor(m.spell, false)].find((p) => missileHitsCapsule(m.pos, p.ai.feet, p.ai.height, PLAYER_BODY_RADIUS));
        if (hitMate) {
          const at = [m.pos[0], m.pos[1], m.pos[2]];
          if (m.spell.rangeType === 4) explodeAt(at, m.spell, effectiveLevel(playerEntity), playerFeet, playerCaster(), { playerHeight, allies: true, duel: !!m.duel, boss: m.boss ?? !!m.duel });
          else if (hitMate.companion) giveToCompanion(hitMate, m.spell);   // COMPANION-KIT
          else giveToAlly(hitMate, m.spell);
          showImpactFlash(m, at);
          retireMissile(m);
          continue;
        }
      }
      // DUEL1: a harmful missile of mine meets my duel opponent's capsule the way it meets a foe's - an AreaAtRange one
      // bursts (reaching whatever else stands in it, the opponent by the duel's door), the rest go to them alone
      if (m.duel) {
        const hitFoe = duelMarksFor(m.spell).find((p) => missileHitsCapsule(m.pos, p.ai.feet, p.ai.height, PLAYER_BODY_RADIUS));
        if (hitFoe) {
          const at = [m.pos[0], m.pos[1], m.pos[2]];
          if (m.spell.rangeType === 4) explodeAt(at, m.spell, effectiveLevel(playerEntity), playerFeet, playerCaster(), { playerHeight, allies: !!m.ally, duel: true, boss: m.boss ?? true });
          else giveToDuel(hitFoe, m.spell);
          showImpactFlash(m, at);
          retireMissile(m);
          continue;
        }
      }
      // WB4b: ...and the court's boss's body, all of it (his own radius) - an AreaAtRange one bursts on him; AUDIT WBX F5:
      // a missile that may meet him (`boss` - a Soul Trap is no duel spell, and flew through him)
      if (m.boss ?? m.duel) {
        const hitBoss = bossMarksFor(m.spell).find((p) => missileHitsCapsule(m.pos, p.ai.feet, p.ai.height, p.ai.radius));
        if (hitBoss) {
          const at = [m.pos[0], m.pos[1], m.pos[2]];
          if (m.spell.rangeType === 4) explodeAt(at, m.spell, effectiveLevel(playerEntity), playerFeet, playerCaster(), { playerHeight, allies: !!m.ally, duel: !!m.duel, boss: true });
          else giveToBoss(hitBoss, m.spell);
          showImpactFlash(m, at);
          retireMissile(m);
          continue;
        }
      }
      for (const f of playerTargets()) {   // DISC19-F (AUDIT DISC19): my missile flies through a defender
        if (f.dead) continue;
        if (missileHitsFoe(m.pos, f)) {   // ROAD-H tail: DaggerfallMissile.cs:339's SphereCast meets the foe's CAPSULE (REVIEW 2026-09-05 had its centre as a point)
          if (m.spell.rangeType === 4) explodeAt(m.pos, m.spell, effectiveLevel(playerEntity), playerFeet, playerCaster(), { playerHeight, allies: !!m.ally, duel: !!m.duel, boss: m.boss ?? !!m.duel });   // ROAD-H H2
          else applySpellToFoe(m.spell, effectiveLevel(playerEntity), f, playerCaster());
          showImpactFlash(m, [m.pos[0], m.pos[1], m.pos[2]]);   // F033
          retireMissile(m);
          break;
        }
      }
    }
    // EVERY ALLOCATION HAS AN OWNER: retired missiles leave the list
    // (their batches were freed at retire).
    for (let i = missiles.length - 1; i >= 0; i--) if (missiles[i].dead) missiles.splice(i, 1);
  }

  /** E2: CastWhenUsed's CasterOnly arm (CastWhenUsed.cs:120-141) -
   *  the item's spell lands on the USER as its own bundle with
   *  BypassSavingThrows | BypassChance; no spell points spend, no
   *  ready is consumed, and the absorb refund cap still reads the
   *  LAST paid cast's cost (lastReadySpellCastingCost is untouched by
   *  item casts). The caster is the player, casterLevel the player's. */
  function castByItemSelf(spell, item = null) {
    if (barredHere()) return null;   // HOME-MAGIC: an item's spell on its user is a cast too
    if (wardedHere(spell)) return null;   // AUDIT-SEATS G5: and a battle's wards turn it
    // D9: EntityEffectBundle.CastByItem (CastWhenUsed.cs:136) - the
    // SOURCE ITEM rides the bundle, and AssignBundle copies it onto
    // the live bundle (EntityEffectManager.cs:469). Open.CheckCastByItem
    // is its only reader and it is why the Skeleton's Key can open a
    // lock above the holder's level at all.
    const r = applySpellToPlayer(spell, effectiveLevel(playerEntity), playerCaster(), { bypassSavingThrows: true, bypassChance: true, castByItem: item });
    if (r.healed > 0) say(`You are healed ${r.healed} points.`);
    surfacePlayer();
    return r;
  }

  return {
    readySpell,
    /** FIX-F: RecastSpell (EntityEffectManager.cs:257-266) - the last
     *  spell cast is readied again, through SetReadySpell's own gates,
     *  if there was one, no cast animation is playing (castInProgress
     *  is PlayerSpellCasting.IsPlayingAnim's stand-in) and the pack
     *  holds a spellbook; without the book, the localized noSpellbook
     *  line. Answers whether it readied. */
    recastSpell() {
      if (!lastSpell || castInProgress) return false;
      if (!hasSpellbook(playerEntity)) { say(NO_SPELLBOOK_TEXT); return false; }
      readySpell(lastSpell);
      return readiedSpell === lastSpell;
    },
    /** FIX-F: AbortSpell -> AbortReadySpell (:268-270, :361-365): only
     *  with a spell readied; the ready and its free flag drop, and the
     *  cost with them (the port keeps the cost beside the ready). */
    abortReadySpell() {
      if (!readiedSpell) return false;
      readiedSpell = null; readiedFree = false; readiedCost = 0;
      return true;
    },
    castInput,
    update,
    castByItemSelf,   // E2: the enchantCtx applySpellToSelf seam
    /** HOME-MAGIC: an item about to cast asks first - the refusal said and true where the place bars it, so the item
     *  spends nothing on a spell that never goes (enchantments.js CastWhenUsed). */
    barCast: () => barredHere(),
    explodeAt,             // the dungeon's enemy half reuses these (M3)
    applySpellToPlayer,
    /** RVN5 (bible/12-Enhanced-AI/Feud-Arc.md 16.1): a FOE's spell on me with no missile - a revenant's pyre - its caster
     *  the wrapper a missile carries (missileCaster: its entity, its sinks), so my reflection sends it back at its body. */
    strikePlayerFrom: (spell, casterLevel, foe) => applySpellToPlayer(spell, casterLevel, foe?.entity ? { entity: foe.entity, sinks: foeSinks(foe), foe } : null),
    /** X11: the FOE door, beside the player one it has always sat
     *  next to internally. Both are needed from outside now - each is
     *  half of Spell Reflection's re-target, and a probe that can only
     *  reach one of them can only see half the bounce. */
    applySpellToFoe,
    /** U44: EntityEffectManager.DrinkPotion (:903-947). The bundle is
     *  potions.js's (BundleTypes.Potion, TargetTypes.CasterOnly, the
     *  recipe's one shared settings struct); this is AssignBundle's
     *  half - BypassSavingThrows | BypassChance (:942) and the cast
     *  sound, which DrinkPotion plays for the PLAYER only (:945-946)
     *  and keys on ElementTypes.Magic. Answers the potion's display
     *  name, or null for a bottle whose recipe key names nothing -
     *  DFU's `PotionRecipeKey == 0` guard (:906). */
    drinkPotion(recipeKey, potent = 0) {
      const plain = potionBundle(recipeKey);
      if (!plain) return null;
      // PROF12: a Potent potion (an alchemy station's brew) lays its share on every magnitude (alchemyLaw potentEffect) -
      // AUDIT PROF12 A3: on its duration (and chance) where its magnitude is DFU's default, at the drinker's level
      const bundle = potent ? { ...plain, effects: plain.effects.map((e) => potentEffect(e, potent, effectiveLevel(playerEntity))) } : plain;
      applySpellToPlayer(bundle, effectiveLevel(playerEntity), null,
        { bypassSavingThrows: true, bypassChance: true });
      audio.playOneShotId(SPELL_CAST_SOUND[bundle.element] ?? SPELL_CAST_SOUND[4], 1);   // AUDIT 58: the same ID door
      return bundle.name;
    },
    /** WeaponManager's HasReadySpell leg - the weapon hides while a
     *  cast is armed or pending. */
    spellArmed: () => readiedSpell != null || pendingClickCast,
    /** The attack click: an ARMED cast consumes the click instead of
     *  a swing. The host fires the cast on its next frame with the
     *  live eye/dir (firePending). */
    interceptAttack(held) {
      if (held && readiedSpell != null && !pendingClickCast) { pendingClickCast = true; return true; }
      return false;
    },
    firePending(eye, dir) {
      // ROAD-E6: every host calls this once a frame with its LIVE
      // eye/dir whether or not a click is pending, which makes it the
      // engine's window onto the caster transform DFU's release-frame
      // missile reads (see lastAim).
      if (eye && dir) lastAim = { eye: [eye[0], eye[1], eye[2]], dir: [dir[0], dir[1], dir[2]] };
      if (!pendingClickCast) return false;
      pendingClickCast = false;
      return castInput(eye, dir);
    },
    /** ROAD-E6: castInProgress (:59) - the 0.2s of hand motion between
     *  the magicka spend and the release frame. Read by the probes and
     *  by a host that wants DFU's own "cast in progress" answer. */
    castInProgress: () => castInProgress,
    /** AUDIT 17e F23 / AUDIT 24 (the seven-slice sweep): the
     *  floating-origin recenter shifts every pool that holds a WORLD
     *  position, and the missiles were the one it never reached -
     *  world.js offset the guards, the encounter foes, the loot piles
     *  and the arrows, and nothing offset these. A pixel crossing
     *  fires an 819.2-unit shift and a missile lives 8 seconds at 25
     *  units, so it is easy to be mid-flight across one: the billboard
     *  jumped out of the world, the wall raycast probed the OLD frame
     *  so it never hit anything, and the foe sweep compared a stale
     *  position against shifted feet so it could never connect. The
     *  spell and its magicka went silently nowhere.
     *
     *  Both `pos` and `firePos` shift - the batch origin is their
     *  DIFFERENCE, recomputed next update, so no GL churn is needed. */
    offsetAll(offset) {
      candle.offsetAll(offset);
      for (const m of peerCandleMounts.values()) m.offsetAll(offset);   // PEERLIGHT2
      impacts.offsetAll(offset);   // F033: a flash mid-animation follows the recenter too
      shiftSparks(offset); fx.shift(offset);   // IMPACTFX: and the bursts
      for (const m of missiles) {
        if (m.dead) continue;
        for (let a = 0; a < 3; a++) {
          m.pos[a] += offset[a];
          if (m.firePos) m.firePos[a] += offset[a];
        }
      }
    },
    batches: () => batches,
    /** PEERLIGHT2: the others' Light spells this frame - `list` [{ id, feet, height, forward }] (scene frame), one
     *  mount each, the rest put out. Answers their point lights (the hosts' shape). An empty list puts them all out. */
    peerCandles(list, dt) {
      const want = new Set();
      _peerCandleLights.length = 0;
      for (const c of list ?? []) {
        if (!c || c.id == null || !c.feet) continue;
        want.add(c.id);
        let m = peerCandleMounts.get(c.id);
        if (!m) { m = mintPeerCandle(); peerCandleMounts.set(c.id, m); }
        m.update(dt, { active: true, feet: c.feet, height: c.height, forward: c.forward });
        const l = m.light();
        if (l) _peerCandleLights.push(l);
      }
      for (const [id, m] of peerCandleMounts) if (!want.has(id)) { m.clear(); peerCandleMounts.delete(id); }
      return _peerCandleLights;
    },
    /** NT1 (F214) / EVERY ALLOCATION HAS AN OWNER: the engine's own
     *  teardown. A per-context engine (the dungeon's, dungeonContext
     *  mints one) dies with its scene, and a spell in flight at the
     *  exit owned a batch nothing could reach - retireMissile frees
     *  each flight (and marks it dead, so an in-flight texture warm
     *  publishes nothing), the candle's clear() drops its sprite
     *  through its own retire path, and whatever still stands in
     *  `batches` (an impact flash mid-fade) frees with the rest.
     *  Terminal: no update runs after this. */
    destroy() {
      for (const m of missiles) retireMissile(m);
      missiles.length = 0;
      candle.clear();
      for (const m of peerCandleMounts.values()) m.clear();   // PEERLIGHT2
      peerCandleMounts.clear();
      clearSparks(); fx.clear();   // IMPACTFX: the bursts die with the engine
      if (fxPass) { const p = fxPass; fxPass = null; fxBroken = true; p.destroy(); }   // IMPACTFX: and their GL pass (the slot emptied first; a draw after this builds nothing)
      impacts.clear();   // AUDIT 68 S21-magic-destroy-impacts: a flash still warming its archive is marked dead, so it publishes nothing into this dead engine
      for (const b of batches) { flatAnims.remove(b); renderer.destroyBillboardBatch(b); }
      batches.length = 0;
    },
    /** AUDIT 39: CleanupUntrackedObjects' MISSILE half
     *  (StreamingWorld.cs:1633-1636) - "Destroy loose missiles" on a
     *  load or a teleport. destroy() above is terminal and takes the
     *  candle and the impact batches with it; the engine outlives a
     *  fast travel, so this frees the flights alone. */
    clearMissiles() {
      for (const m of missiles) retireMissile(m);
      missiles.length = 0;
      clearSparks(); fx.clear();   // IMPACTFX: a load or a teleport leaves no burst behind in the old place
    },
    /** X11: the candle's point light, in nearestLights' own vec4 shape,
     *  or null. Each host prepends it to the array it hands the
     *  renderer - the candle is 1.4 units away, so it is always the
     *  nearest light there is and the sort would put it first anyway. */
    /** ART-COLOUR: each element's burst colour as drawn now, and whether it came from the art - for the console. */
    fxColours: () => fx.artColours(),
    candleLight: () => candle.light() ?? fx.light(),   // IMPACTFX: a landing spell lights the walls for a moment (never over the Light effect's candle)
    /** IMPACTFX: THE BURSTS' PASS - the hosts call this right after this engine's billboards, in their world pass,
     *  under the renderer's own camera and fog. Answers whether it drew (it marks the foreign pass itself). */
    drawFx() {
      if (!fx.live || fxBroken || !renderer?.gl || !renderer._proj || !renderer._view) return false;
      const n = fx.build();
      if (!n) return false;
      if (!fxPass) { try { fxPass = new SpellImpactPass(renderer.gl); } catch (e) { fxBroken = true; console.warn('[magic] the impact pass would not build', e?.message ?? e); return false; } }
      renderer.endUiRun?.();
      const eye = renderer._camPos;
      fxPass.draw(fx.buf, n, renderer._proj, renderer._view, eye, { mode: renderer._fogMode, density: renderer._fogDensity, range: renderer._fogRange, camPos: eye, focus: renderer._focus });
      renderer.markForeignPass?.();
      return true;
    },
    missileCount: () => missiles.length,   // M5 probe surface
    readied: () => readiedSpell,
    readiedIndex: () => readiedSpell?.index ?? null,
    // CAST-USE (AUDIT part five CU2): the ready's STORED price - 0 for a free one (an item's, a trap's) - which the HUD's
    // ready line prints, never a price recomputed off the record
    readiedCost: () => (readiedSpell ? readiedCost : 0),
    // CAST-USE (AUDIT part five CU1): a mode flip hands the ready on to the engine that fires where the player now stands
    // (the street's and the dungeon context's are two) - DFU's one EntityEffectManager keeps readySpell, its freeness and
    // its price across a transition. A ready left on the other engine was stranded (the street's fired at the first
    // click back outside) or destroyed with the dungeon's, the item's condition spent and no spell cast.
    handReadyTo(other) {
      if (!readiedSpell || !other?.takeReady) return false;
      other.takeReady({ sp: readiedSpell, free: readiedFree, cost: readiedCost });
      readiedSpell = null; readiedFree = false; readiedCost = 0; pendingClickCast = false;
      return true;
    },
    takeReady({ sp = null, free = false, cost = 0 } = {}) { readiedSpell = sp; readiedFree = !!sp && !!free; readiedCost = sp ? cost : 0; },
    allyInReach,   // AUDIT ALLY-CAST A5: the plaque's question, answered by THIS engine's pick and collider
    setReadiedByIndex(index, spellsByIndex) {
      // S1: a MADE spell has no SPELLS.STD index (it carries a
      // negative one of its own), so the file table cannot answer for
      // it - the player's own book can. Without this a custom spell
      // readied at save time came back unreadied.
      readiedSpell = index != null
        ? (spellsByIndex?.get(index) ?? (playerEntity?.spells ?? []).find((sp) => sp?.index === index) ?? null)
        : null;
      readiedFree = false;   // every writer of readiedSpell declares its freeness (magic-8)
      // AUDIT 58: and every writer of readiedSpell declares its PRICE
      // too - readySpellCastingCost is set beside readySpell at
      // :327-328, so a restored ready is priced at restore time rather
      // than re-priced at the click.
      readiedCost = readiedSpell ? calculateCastCost(readiedSpell, playerEntity).sp : 0;
    },
    setReadied(sp) {
      readiedSpell = sp ?? null;
      readiedFree = false;
      readiedCost = readiedSpell ? calculateCastCost(readiedSpell, playerEntity).sp : 0;   // :327-328
    },
    /** SPELLFX1: another player's cast, DRAWN (the Unity co-op's RpcPlayPlayerSpellCastVisual): a ranged cast flies as
     *  a missile of its element from their eye along their aim, and a touch, self or area cast flashes where it went
     *  off. Visual only - nothing is applied, spent, tallied or heard as a hit. */
    spellVisual({ from, dir, element = 4, rangeType = 2, casterId = null }) {
      if (!Array.isArray(from) || from.length !== 3 || !from.every(Number.isFinite)) return false;
      const el = Number.isInteger(element) && element >= 0 && element <= 4 ? element : 4;
      // SPELLFX2 (2026-09-23, per-request: "give the spell projectiles sound and casting sound like the player has
      // for himself"): THE CAST IS HEARD WHERE IT WAS CAST. The player's own cast plays the element's cast sound
      // at release (tallyCastSkills, PlayCastSound) - a missile of this engine carries no sound of its own after
      // that, its whoosh IS the cast sound. A peer's cast plays that same clip from the peer's own position, on
      // the enemy casters' 3D door and distance (EnemyCastReadySpell's play3dId, maxDistance 16).
      try { audio.play3dId?.(SPELL_CAST_SOUND[el] ?? SPELL_CAST_SOUND[4], from, 1, { maxDistance: 16 }); } catch { /* a sound never costs the visual */ }
      if (rangeType === 2 || rangeType === 4) {
        if (!Array.isArray(dir) || dir.length !== 3 || !dir.every(Number.isFinite)) return false;
        missiles.push({ spell: { element: el, rangeType }, pos: [...from], dir: [...dir], age: 0, batch: null, fromPlayer: null, visual: true, casterId });
        return true;
      }
      // a touch goes off at arm's length along the aim; a self or area cast on the caster's own body
      const at = rangeType === 1 && Array.isArray(dir) ? [from[0] + dir[0] * 1.5, from[1] + dir[1] * 1.5, from[2] + dir[2] * 1.5] : [from[0], from[1] - 0.6, from[2]];
      impacts.showImpactFlash(missileArchive(el), at);
      if (rangeType === 1) landFx(elementFxKind(el), at, { scale: 0.75, power: 0.6, heard: 24 });   // IMPACTFX: a peer's touch, its small spray
      return true;
    },
    /** SUNBABY2: a fireball the evil sun baby throws (world/sunbabySky.js sunbabyFireball) - a DRAWN fire missile,
     *  spellVisual's kind, falling `from` the sky `to` the ground at the engine's own speed, SKY_FIRE_SCALE times the
     *  flat's size. It flashes and is heard where it lands, or on a roof or a body it meets first. Visual only: nothing
     *  is applied, spent or tallied - an event burns no one. */
    skyFire({ from, to }) {
      const ok = (p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);
      if (!ok(from) || !ok(to)) return false;
      const d = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
      if (!(d > 0)) return false;
      missiles.push({ spell: { element: 0, rangeType: 2 }, pos: [...from], dir: [(to[0] - from[0]) / d, (to[1] - from[1]) / d, (to[2] - from[2]) / d], age: 0, batch: null, fromPlayer: null, visual: true, casterId: null, sky: true, to: [...to], left: d, scale: SKY_FIRE_SCALE });
      return true;
    },
    /** X3-slice: an enemy spell missile joins the engine's pool -
     *  aimed by the caller (the host aims at the player mid-capsule
     *  at fire time, the trap/dungeon shape). */
    fireEnemyMissile(from, dir, spell, casterLevel, casterFoe) {
      missiles.push({ spell, casterLevel, casterFoe, pos: [...from], dir: [...dir], age: 0, batch: null, fromPlayer: false });
    },
  };
}
