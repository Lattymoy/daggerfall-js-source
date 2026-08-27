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
import {
  missileArchive, MISSILE_SPEED, MISSILE_COLLIDER_RADIUS,
  MISSILE_LIFESPAN_S, EXPLOSION_RADIUS, pickTouchTarget, sweepFoes,
} from '../systems/spellcast.js';
import { silenceBlocksCast, SILENCED_TEXT, PRESS_BUTTON_TO_FIRE_SPELL, DOOR_SPELL_TEXT, SOUL_TRAP_TEXT } from '../systems/mysticism.js';
import { calculateCastCost, effectSchool, EFFECT_COST_TABLE } from '../systems/spellcost.js';
import { applySpell, SPELL_REFLECTED_TEXT, hasActiveEffect } from '../systems/effects.js';
import { potionBundle } from '../systems/potions.js';   // U44: DrinkPotion's bundle
import { SPELL_CAST_SOUND } from '../systems/enemySpells.js';
import { tallySkill } from '../systems/skills.js';
import { morphSelf } from '../systems/lycanthropy.js';   // V2a: the MorphSelf arm the ONE cast engine wires
import { scaledBillboardSize } from '../world/rmbFlats.js';
import { createMagicCandle, CANDLE } from './magicCandle.js';   // X11: the Light effect's candle
import { CAPSULE_HEIGHT } from '../player/motor.js';   // PlayerController.height, the candle's y term
import { createHitEffects } from './hitEffects.js';   // AUDIT 26 F033: DaggerfallMissile's impact flash

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
}) {
  const playerCaster = () => ({ entity: playerEntity, sinks: playerSinks });
  // Classic click-to-cast: DFU's armed state IS the readied spell -
  // EntityEffectManager.cs:250 fires on `readySpell != null`, and
  // CastReadySpell clears it. The port used to mirror that in a
  // separate one-shot latch, which could DESYNC from readiedSpell
  // (setReadiedByIndex set the spell and not the latch - found live
  // by the I2 cast probe). The latch is gone; armed derives.
  let pendingClickCast = false;
  let readiedSpell = null;
  let readiedFree = false;   // readySpellDoesNotCostSpellPoints (magic-8)
  // AUDIT 23 (magic-5): DFU's lastReadySpellCastingCost - set on every
  // player cast, read by the absorption refund cap when the player's
  // own spell lands back on them (EntityEffectManager.cs:600-604).
  let lastCastCost = 0;
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

  // AUDIT 26 F033: the impact flash needs the same three renderer deps
  // the candle takes, and rides `batches` the same way.
  const impacts = createHitEffects({
    renderer,
    getTexture,
    uploadRecordFrame: uploadRecord,
    onSpawn: (b) => batches.push(b),
    onRetire: (b) => { const i = batches.indexOf(b); if (i >= 0) batches.splice(i, 1); },
  });
  /** DaggerfallMissile.DoCollision (:364-370) - record 1 of the
   *  missile's own element archive, one-shot at 15fps, gated on
   *  `elementType != None && targetType != ByTouch` (rangeType 1). */
  function showImpactFlash(m, pos) {
    if (!m.spell || m.spell.element == null || m.spell.rangeType === 1) return;
    impacts.showImpactFlash(missileArchive(m.spell.element), pos);
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
  function applySpellToFoe(spell, casterLevel, foe, caster = null, ctx = undefined) {
    const r = applySpell(spell, casterLevel, foe.entity, foeSinks(foe), rolls, caster, ctx);
    if (r.trapAlert) say(SOUL_TRAP_TEXT[r.trapAlert]);
    // X8: PACIFY / CHARM. The effect answers whether the target was
    // pacified; the AI flag lives on the foe RECORD rather than the
    // entity, so this door - the one place that holds both - is where
    // it lands. Permanent by design: nothing expires it, and the
    // damage doors restore hostility when the player attacks
    // (MakeEnemyHostileToAttacker), which is classic's own
    // "until player attacks them".
    if (r.pacify && foe.ai) foe.ai.isHostile = false;
    // X11: SPELL REFLECTION - the FOE is the reflector here, so no HUD
    // line (TryReflection's "Spell was reflected." is gated on
    // `IsPlayerEntity` on the REFLECTING manager, EEM:1231-1233), and
    // the bundle goes back at whoever cast it. This function is DFU's
    // `casterEffectManager.AssignBundle(sourceBundle)`: the seam that
    // holds both parties, which is why the re-target lives here and
    // not inside the effect module.
    if (r.reflected && caster?.entity) {
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
  function explodeAt(pos, spell, casterLevel, playerFeet, caster = null, { excludeFoe = null } = {}) {
    for (const t of sweepFoes(pos, EXPLOSION_RADIUS, foes())) {
      if (excludeFoe && t === excludeFoe) continue;
      applySpellToFoe(spell, casterLevel, t, caster);
    }
    if (playerFeet) {
      const d = Math.hypot(playerFeet[0] - pos[0], playerFeet[1] + 0.9 - pos[1], playerFeet[2] - pos[2]);
      if (d <= EXPLOSION_RADIUS) applySpellToPlayer(spell, casterLevel, caster);
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
    audio.playOneShot(SPELL_CAST_SOUND[sp.element] ?? SPELL_CAST_SOUND[4], 1);
  }

  /** S5/S7/S9/S10: the cast itself - the four range arms, each
   *  spending, recording the refund-cap cost, tallying, and firing. */
  function castInput(eye, dir) {
    const sp = readiedSpell;
    if (!sp) return false;
    // S27 / SilenceCheck (EntityEffectManager :1932-1946). DFU tests
    // this at CAST as well as at ready, and BOTH clear the readied
    // spell - a silence landing mid-aim disarms you rather than
    // waiting for the click. L2-slice (magic-8): a FREE ready (a
    // trap's CasterOnly payload) bypasses the gate, exactly as :404
    // gates SilenceCheck on !readySpellDoesNotCostSpellPoints.
    if (!readiedFree && silenceBlocksCast(playerEntity)) {
      readiedSpell = null;
      say(SILENCED_TEXT);
      return false;
    }
    const cost = readiedFree ? 0 : calculateCastCost(sp, playerEntity).sp;   // S10: the per-effect skill-scaled cost; free readies spend nothing
    if ((playerEntity.magicka ?? 0) < cost) return false;   // classic refuses without the points
    if (sp.rangeType === 0) {
      // S7: CasterOnly applies to SELF (Balyna's Balm heals) - no
      // missile; the cost spends here.
      playerEntity.magicka -= cost;
      tallyCastSkills(sp);
      const r = applySpellToPlayer(sp, playerEntity.level, playerCaster());
      // AUDIT 24 scenes: PlayerSpellCasting_OnReleaseFrame assigns the
      // CasterOnly bundle at :2117 and only stamps
      // `lastReadySpellCastingCost = readySpellCastingCost` at :2138 -
      // AFTER it. So AssignBundle's absorption cap (:603, gated on
      // `lastReadySpellCastingCost > 0`) reads the PREVIOUS player
      // cast's cost, not this one's; on the session's first self-cast
      // the gate fails outright and nothing is capped.
      lastCastCost = cost;
      if (r.healed > 0) say(`You are healed ${r.healed} points.`);
      surfacePlayer();
      readiedSpell = null;   // DFU OnReleaseFrame: a cast consumes the ready
      return true;
    }
    if (sp.rangeType === 1) {
      // ByTouch: CastReadySpell aborts BEFORE spending when no target
      // sits in touch range (verbatim - the S9 'spends on a whiff'
      // rule was wrong and died at its audit). L2-slice (magic-7):
      // the pick is now the 0.25-radius sphere-cast 3.0 ALONG THE
      // AIM, not a nearest-in-radius sweep.
      const t = pickTouchTarget(eye, dir, foes(), (c, d) => {
        const l = d || 1, dx = (c[0] - eye[0]) / l, dy = (c[1] - eye[1]) / l, dz = (c[2] - eye[2]) / l;
        const hit = collider.raycast(eye, [dx, dy, dz], d);
        return !Number.isFinite(hit) || hit >= d - 1e-3;
      });
      if (!t) return false;
      playerEntity.magicka -= cost;
      lastCastCost = cost;
      tallyCastSkills(sp);
      surfacePlayer();
      applySpellToFoe(sp, playerEntity.level, t, playerCaster());
      readiedSpell = null;   // DFU OnReleaseFrame: a cast consumes the ready
      return true;
    }
    if (sp.rangeType === 3) {
      // AreaAroundCaster: every live foe within the explosion radius.
      playerEntity.magicka -= cost;
      lastCastCost = cost;
      tallyCastSkills(sp);
      surfacePlayer();
      for (const t of sweepFoes(eye, EXPLOSION_RADIUS, foes())) {
        applySpellToFoe(sp, playerEntity.level, t, playerCaster());
      }
      readiedSpell = null;   // DFU OnReleaseFrame: a cast consumes the ready
      return true;
    }
    if (sp.rangeType !== 2 && sp.rangeType !== 4) return false;
    playerEntity.magicka -= cost;
    lastCastCost = cost;
    tallyCastSkills(sp);
    surfacePlayer();
    missiles.push({ spell: sp, pos: [eye[0], eye[1], eye[2]], dir: [...dir], age: 0, batch: null, fromPlayer: true });
    readiedSpell = null;   // DFU OnReleaseFrame: a cast consumes the ready
    return true;
  }

  /** The spellbook's ready hook - DFU's SetReadySpell laws in order:
   *  the silence gate (S27), the cost gate with the classic refusal
   *  (AUDIT 23 magic-14, :337-343), the assignment, and the instant
   *  CasterOnly cast (:350-351). L2-slice (AUDIT 23 magic-8): `free`
   *  is SetReadySpell's noSpellPointCost - a trap's CasterOnly spell
   *  readies ON THE PLAYER for free, BYPASSING the silence gate
   *  (:315 gates SilenceCheck on !noSpellPointCost) and the cost. */
  function readySpell(sp, { free = false } = {}) {
    if (!free && silenceBlocksCast(playerEntity)) { readiedSpell = null; say(SILENCED_TEXT); return; }
    if (!free && (playerEntity.magicka ?? 0) < calculateCastCost(sp, playerEntity).sp) {
      readiedSpell = null;
      say("You don't have the spell points.");   // youDontHaveTheSpellPoints
      return;
    }
    readiedSpell = sp;
    readiedFree = free;
    if (sp.rangeType === 0) { castInput(null, null); return; }
    // AUDIT 24 scenes: SetReadySpell's own line, verbatim -
    // GetLocalizedText("pressButtonToFireSpell") = "Press button to
    // fire spell." (Internal_Strings_en, EntityEffectManager.cs:355).
    say(PRESS_BUTTON_TO_FIRE_SPELL);   // classic: the next attack-click CASTS
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
    const size = scaledBillboardSize(t.getSize(0), t.getScale(0));
    m.firePos = [...m.pos];
    m.batch = renderer.createBillboardBatch(archive, 0, size, [[m.firePos[0], m.firePos[1], m.firePos[2]]]);
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
  function update(dt, playerFeet, forward = null, playerHeight = CAPSULE_HEIGHT) {
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
      feet: playerFeet ?? [0, 0, 0],
      height: playerHeight,
      forward,
    });
    for (const m of missiles) {
      if (m.dead) continue;
      ensureMissileBatch(m);
      m.age += dt;
      if (m.age > MISSILE_LIFESPAN_S) { retireMissile(m); continue; }
      const step = MISSILE_SPEED * dt;
      const hitWall = collider.raycast(m.pos, m.dir, step + MISSILE_COLLIDER_RADIUS);
      if (Number.isFinite(hitWall) && hitWall <= step + MISSILE_COLLIDER_RADIUS) {
        const impact = [m.pos[0] + m.dir[0] * hitWall, m.pos[1] + m.dir[1] * hitWall, m.pos[2] + m.dir[2] * hitWall];
        if (m.spell.rangeType === 4) {
          explodeAt(impact, m.spell, playerEntity.level, playerFeet, playerCaster());
        }
        showImpactFlash(m, impact);   // F033: DFU flashes on ANY wall hit, AoE or not
        retireMissile(m);
        continue;
      }
      m.pos[0] += m.dir[0] * step; m.pos[1] += m.dir[1] * step; m.pos[2] += m.dir[2] * step;
      // The batch was built ONCE at the fire position; flight rides
      // the batch's origin uniform (zero GL churn).
      if (m.batch) m.batch.origin = [m.pos[0] - m.firePos[0], m.pos[1] - m.firePos[1], m.pos[2] - m.firePos[2]];
      // X3-slice: an ENEMY missile hunts the PLAYER (the dungeon's
      // arm: the caster wrapper rides the impact; foe-vs-foe
      // friendly fire pends the target sweep, the shared residual).
      if (m.fromPlayer === false) {
        if (playerFeet) {
          const px = playerFeet[0] - m.pos[0], py = playerFeet[1] + 0.9 - m.pos[1], pz = playerFeet[2] - m.pos[2];
          if (Math.hypot(px, py, pz) <= MISSILE_COLLIDER_RADIUS + 0.45) {
            const mCaster = m.casterFoe ? { entity: m.casterFoe.entity, sinks: foeSinks(m.casterFoe) } : null;
            if (m.spell.rangeType === 4) explodeAt(m.pos, m.spell, m.casterLevel ?? 1, playerFeet, mCaster);
            else applySpellToPlayer(m.spell, m.casterLevel ?? 1, mCaster);
            showImpactFlash(m, [m.pos[0], m.pos[1], m.pos[2]]);   // F033
            retireMissile(m);
          }
        }
        continue;
      }
      for (const f of foes()) {
        if (f.dead) continue;
        const fx = f.ai.feet[0] - m.pos[0], fy = f.ai.feet[1] + 0.9 - m.pos[1], fz = f.ai.feet[2] - m.pos[2];
        if (Math.hypot(fx, fy, fz) <= MISSILE_COLLIDER_RADIUS + 0.45) {
          if (m.spell.rangeType === 4) explodeAt(m.pos, m.spell, playerEntity.level, playerFeet, playerCaster());
          else applySpellToFoe(m.spell, playerEntity.level, f, playerCaster());
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
  function castByItemSelf(spell) {
    const r = applySpellToPlayer(spell, playerEntity.level, playerCaster(), { bypassSavingThrows: true, bypassChance: true });
    if (r.healed > 0) say(`You are healed ${r.healed} points.`);
    surfacePlayer();
    return r;
  }

  return {
    readySpell,
    castInput,
    update,
    castByItemSelf,   // E2: the enchantCtx applySpellToSelf seam
    explodeAt,             // the dungeon's enemy half reuses these (M3)
    applySpellToPlayer,
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
    drinkPotion(recipeKey) {
      const bundle = potionBundle(recipeKey);
      if (!bundle) return null;
      applySpellToPlayer(bundle, playerEntity.level, null,
        { bypassSavingThrows: true, bypassChance: true });
      audio.playOneShot(SPELL_CAST_SOUND[bundle.element] ?? SPELL_CAST_SOUND[4], 1);
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
      if (!pendingClickCast) return false;
      pendingClickCast = false;
      return castInput(eye, dir);
    },
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
      impacts.offsetAll(offset);   // F033: a flash mid-animation follows the recenter too
      for (const m of missiles) {
        if (m.dead) continue;
        for (let a = 0; a < 3; a++) {
          m.pos[a] += offset[a];
          if (m.firePos) m.firePos[a] += offset[a];
        }
      }
    },
    batches: () => batches,
    /** X11: the candle's point light, in nearestLights' own vec4 shape,
     *  or null. Each host prepends it to the array it hands the
     *  renderer - the candle is 1.4 units away, so it is always the
     *  nearest light there is and the sort would put it first anyway. */
    candleLight: () => candle.light(),
    candleRange: CANDLE.range,
    missileCount: () => missiles.length,   // M5 probe surface
    readied: () => readiedSpell,
    readiedIndex: () => readiedSpell?.index ?? null,
    setReadiedByIndex(index, spellsByIndex) {
      // S1: a MADE spell has no SPELLS.STD index (it carries a
      // negative one of its own), so the file table cannot answer for
      // it - the player's own book can. Without this a custom spell
      // readied at save time came back unreadied.
      readiedSpell = index != null
        ? (spellsByIndex?.get(index) ?? (playerEntity?.spells ?? []).find((sp) => sp?.index === index) ?? null)
        : null;
      readiedFree = false;   // every writer of readiedSpell declares its freeness (magic-8)
    },
    setReadied(sp) { readiedSpell = sp ?? null; readiedFree = false; },
    /** X3-slice: an enemy spell missile joins the engine's pool -
     *  aimed by the caller (the host aims at the player mid-capsule
     *  at fire time, the trap/dungeon shape). */
    fireEnemyMissile(from, dir, spell, casterLevel, casterFoe) {
      missiles.push({ spell, casterLevel, casterFoe, pos: [...from], dir: [...dir], age: 0, batch: null, fromPlayer: false });
    },
  };
}
