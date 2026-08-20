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
// arms, explodeAt, and PLAYER spell missiles (flight, wall explode,
// foe seek, billboard batches). Enemy missiles and arrows stay with
// the dungeon host - different owners (EnemyAttack / the bow) and no
// exterior producer yet.
//
// deps:
//   renderer, audio           - batches + the cast/element sounds
//   getTexture, uploadRecord  - the missile billboard mount
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

import {
  missileArchive, MISSILE_SPEED, MISSILE_COLLIDER_RADIUS,
  MISSILE_LIFESPAN_S, EXPLOSION_RADIUS, pickTouchTarget, sweepFoes,
} from '../systems/spellcast.js';
import { silenceBlocksCast, SILENCED_TEXT } from '../systems/mysticism.js';
import { calculateCastCost, effectSchool, EFFECT_COST_TABLE } from '../systems/spellcost.js';
import { applySpell } from '../systems/effects.js';
import { SPELL_CAST_SOUND } from '../systems/enemySpells.js';
import { tallySkill } from '../systems/skills.js';
import { scaledBillboardSize } from '../world/rmbFlats.js';
import { OneShotLatch } from '../ui/input.js';

export function createPlayerMagic({
  renderer, audio, getTexture, uploadRecord, collider,
  playerEntity, playerSinks, say, surfacePlayer,
  foes, foeSinks, absorbCtx,
  rolls = Math.random,   // ENGINE-PRNG RULE: the saving-throw/magnitude roll slot (uniform; sequence-free)
}) {
  const playerCaster = () => ({ entity: playerEntity, sinks: playerSinks });
  const clickCast = new OneShotLatch();   // classic click-to-cast: armed by readying
  let pendingClickCast = false;
  let readiedSpell = null;
  // AUDIT 23 (magic-5): DFU's lastReadySpellCastingCost - set on every
  // player cast, read by the absorption refund cap when the player's
  // own spell lands back on them (EntityEffectManager.cs:600-604).
  let lastCastCost = 0;
  const missiles = [];
  const batches = [];

  /** Every spell landing ON THE PLAYER rides this: the S19 Paralyze
   *  awakeAlert ("You are paralyzed.", once per new instance) fires
   *  for player hosts only, exactly like DFU's StartParalyzation. */
  function applySpellToPlayer(spell, casterLevel, caster = null) {
    // S24: the absorption context, read from the HOST at landing.
    const base = absorbCtx();
    const ctx = lastCastCost > 0 ? { ...base, selfCastCost: lastCastCost } : base;
    const r = applySpell(spell, casterLevel, playerEntity, playerSinks, rolls, caster, ctx);
    if (r.paralyzed) say('You are paralyzed.');
    // S19c: AssignBundle's failure messages, player hosts only -
    // CasterOnly chance fails say "Spell effect failed.", external
    // contact fails and full saves say "Save versus spell made."
    if (r.chanceFailed) say(spell.rangeType === 0 ? 'Spell effect failed.' : 'Save versus spell made.');
    if (r.saved) say('Save versus spell made.');
    return r;
  }

  // Cast ranges II: the rangeType-4 EXPLOSION - indiscriminate sweep
  // (OverlapSphere at impact): every live foe within the radius, and
  // the player when close enough.
  function explodeAt(pos, spell, casterLevel, playerFeet, caster = null) {
    for (const t of sweepFoes(pos, EXPLOSION_RADIUS, foes())) {
      applySpell(spell, casterLevel, t.entity, foeSinks(t), rolls, caster);
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
    // waiting for the click. Every cast on this path costs spell
    // points, so DFU's `!noSpellPointCost` arm is always true here.
    if (silenceBlocksCast(playerEntity)) {
      readiedSpell = null;
      say(SILENCED_TEXT);
      return false;
    }
    const cost = calculateCastCost(sp, playerEntity).sp;   // S10: the per-effect skill-scaled cost
    if ((playerEntity.magicka ?? 0) < cost) return false;   // classic refuses without the points
    if (sp.rangeType === 0) {
      // S7: CasterOnly applies to SELF (Balyna's Balm heals) - no
      // missile; the cost spends here.
      playerEntity.magicka -= cost;
      lastCastCost = cost;
      tallyCastSkills(sp);
      const r = applySpellToPlayer(sp, playerEntity.level, playerCaster());
      if (r.healed > 0) say(`You are healed ${r.healed} points.`);
      surfacePlayer();
      readiedSpell = null;   // DFU OnReleaseFrame: a cast consumes the ready
      return true;
    }
    if (sp.rangeType === 1) {
      // ByTouch: CastReadySpell aborts BEFORE spending when no target
      // sits in touch range (verbatim - the S9 'spends on a whiff'
      // rule was wrong and died at its audit).
      const t = pickTouchTarget(eye, foes(), 2.25 + 0.25, (c, d) => {
        const l = d || 1, dx = (c[0] - eye[0]) / l, dy = (c[1] - eye[1]) / l, dz = (c[2] - eye[2]) / l;
        const hit = collider.raycast(eye, [dx, dy, dz], d);
        return !Number.isFinite(hit) || hit >= d - 1e-3;
      });
      if (!t) return false;
      playerEntity.magicka -= cost;
      lastCastCost = cost;
      tallyCastSkills(sp);
      surfacePlayer();
      applySpell(sp, playerEntity.level, t.entity, foeSinks(t), rolls, playerCaster());
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
        applySpell(sp, playerEntity.level, t.entity, foeSinks(t), rolls, playerCaster());
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
   *  CasterOnly cast (:350-351). */
  function readySpell(sp) {
    if (silenceBlocksCast(playerEntity)) { readiedSpell = null; say(SILENCED_TEXT); return; }
    if ((playerEntity.magicka ?? 0) < calculateCastCost(sp, playerEntity).sp) {
      readiedSpell = null;
      say("You don't have the spell points.");   // youDontHaveTheSpellPoints
      return;
    }
    readiedSpell = sp;
    if (sp.rangeType === 0) { castInput(null, null); return; }
    clickCast.arm();
    say(`${sp.name} readied.`);   // classic: the next attack-click CASTS
  }

  async function ensureMissileBatch(m) {
    if (m.batch !== null) return;
    m.batch = false;   // in-flight guard
    const archive = missileArchive(m.spell.element);
    const t = await getTexture(archive);
    if (!t) return;
    uploadRecord(archive, 0);
    const size = scaledBillboardSize(t.getSize(0), t.getScale(0));
    m.firePos = [...m.pos];
    m.batch = renderer.createBillboardBatch(archive, 0, size, [[m.firePos[0], m.firePos[1], m.firePos[2]]]);
    batches.push(m.batch);
  }

  function retireMissile(m) {
    if (m.batch) {
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
  function update(dt, playerFeet) {
    for (const m of missiles) {
      if (m.dead) continue;
      ensureMissileBatch(m);
      m.age += dt;
      if (m.age > MISSILE_LIFESPAN_S) { retireMissile(m); continue; }
      const step = MISSILE_SPEED * dt;
      const hitWall = collider.raycast(m.pos, m.dir, step + MISSILE_COLLIDER_RADIUS);
      if (Number.isFinite(hitWall) && hitWall <= step + MISSILE_COLLIDER_RADIUS) {
        if (m.spell.rangeType === 4) {
          const impact = [m.pos[0] + m.dir[0] * hitWall, m.pos[1] + m.dir[1] * hitWall, m.pos[2] + m.dir[2] * hitWall];
          explodeAt(impact, m.spell, playerEntity.level, playerFeet, playerCaster());
        }
        retireMissile(m);
        continue;
      }
      m.pos[0] += m.dir[0] * step; m.pos[1] += m.dir[1] * step; m.pos[2] += m.dir[2] * step;
      // The batch was built ONCE at the fire position; flight rides
      // the batch's origin uniform (zero GL churn).
      if (m.batch) m.batch.origin = [m.pos[0] - m.firePos[0], m.pos[1] - m.firePos[1], m.pos[2] - m.firePos[2]];
      for (const f of foes()) {
        if (f.dead) continue;
        const fx = f.ai.feet[0] - m.pos[0], fy = f.ai.feet[1] + 0.9 - m.pos[1], fz = f.ai.feet[2] - m.pos[2];
        if (Math.hypot(fx, fy, fz) <= MISSILE_COLLIDER_RADIUS + 0.45) {
          if (m.spell.rangeType === 4) explodeAt(m.pos, m.spell, playerEntity.level, playerFeet, playerCaster());
          else applySpell(m.spell, playerEntity.level, f.entity, foeSinks(f), rolls, playerCaster());
          retireMissile(m);
          break;
        }
      }
    }
    // EVERY ALLOCATION HAS AN OWNER: retired missiles leave the list
    // (their batches were freed at retire).
    for (let i = missiles.length - 1; i >= 0; i--) if (missiles[i].dead) missiles.splice(i, 1);
  }

  return {
    readySpell,
    castInput,
    update,
    explodeAt,             // the dungeon's enemy half reuses these (M3)
    applySpellToPlayer,
    /** WeaponManager's HasReadySpell leg - the weapon hides while a
     *  cast is armed or pending. */
    spellArmed: () => clickCast.armed || pendingClickCast,
    /** The attack click: an ARMED cast consumes the click instead of
     *  a swing. The host fires the cast on its next frame with the
     *  live eye/dir (firePending). */
    interceptAttack(held) {
      if (held && clickCast.consume()) { pendingClickCast = true; return true; }
      return false;
    },
    firePending(eye, dir) {
      if (!pendingClickCast) return false;
      pendingClickCast = false;
      return castInput(eye, dir);
    },
    batches: () => batches,
    missileCount: () => missiles.length,   // M5 probe surface
    readied: () => readiedSpell,
    readiedIndex: () => readiedSpell?.index ?? null,
    setReadiedByIndex(index, spellsByIndex) {
      readiedSpell = index != null ? spellsByIndex?.get(index) ?? null : null;
    },
    setReadied(sp) { readiedSpell = sp ?? null; },
  };
}
