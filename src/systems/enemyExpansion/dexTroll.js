// DEX5 (2026-10-20, bible/04-Characters/Enemy-Expansion.md section 11; Mac, 2026-10-19: "I want to implement this as our
// next mod 1:1") - THE TROLL THAT GETS BACK UP. Daggerfall Enemy Expansion ships a prefab for the Troll's corpse picture
// (`1618_20`, its components in vendor/daggerfall-enemy-expansion/Prefabs/), which DFU stands in the corpse's place
// (scenes/corpseMarker.js registerCorpsePrefab, the port's door for it). What the prefab is, read off its own scripts:
//   - NO LOOT (BestiaryTrollCorpseBillboard.PostParentedSetup, :252-292): the loot container's DaggerfallLoot and its
//     colliders destroyed - the body is never searched, and what it carried goes with it.
//   - AN ENTITY OF ITS OWN (BestiaryTrollCorpseEntity, :38-52): health 1 of 1, the troll's career, and nothing else a
//     DaggerfallEntity does not start with (every stat 50, level 0). Its behaviour is EntityType None (the prefab's own
//     DaggerfallEntityBehaviour, Prefabs/1618_20.components.json), so DFU's WeaponDamage passes it by - a blade or an
//     arrow harms nothing - and its EntityEffectManager takes a spell's bundle: only a missile reaches it, through the
//     prefab's trigger sphere (radius 1 - touch and an explosion's overlap ignore triggers). A bundle that brings its
//     health to 0 (SetHealth, :54-73) says the death ("%s just died.", DisableEnemyDeathAlert its gate), stands the ASH
//     (1618/21, its CENTRE 0.1 over the body's foot - CreateDaggerfallBillboardGameObject aligns nothing) and destroys
//     the body: the troll is gone for good.
//   - THE RISE (Update, :76-106): RespawnTime (10 s, the prefab's) counts down in game time, frozen while
//     Cheat.DisableTrollRespawn is on; at 0 a NEW troll of the dead one's kind stands where the body lay (CreateEnemy -
//     hostile, no quest's, no save's: its LoadID is 0), the body is destroyed and the HUD says "The {name} has recovered
//     from its injuries." (the mod's own English, a C# literal - here a port string)
//   - THE SAVE (BestiaryTrollCorpseSerializer, BestiarySaveInterface): every body still down, with its time left; a load
//     sets each again (one with no time left is skipped, :63-64 - DFU re-creates nothing for it).
// ONLINE (DEX5b): the foe's runner counts, rises and burns; a copy's missile sends its bundle to the runner (`send`), and
// the runner's record says the body is gone (`bg` - `gone(kind)`), so every machine loses it as the runner did.
// A LEAF over the door: the hosts' reach (`host` - runs, body, rise, vanish, toAsh, send, say, key; corpseMarker.js,
// scenes/corpsePrefabHost.js) does the standing. AUDIT DEX D8: the rise ASKS - the new troll stands, and only then does the
// body go and the HUD say so; while it is asked the body is gone to the world (DFU destroys it at once), and a stand
// refused leaves it lying, to try again after its time.

import { DEX_TABLE_TEXT } from './dexTableText.js';
import { registerCorpsePrefab, sayEnemyDied } from '../../scenes/corpseMarker.js';
import { applySpell } from '../effects.js';
import { runMagicRoundsFor } from '../worldTick.js';
import { modSetting } from '../modSettings.js';
import { registerModSaveData } from '../modSaveData.js';
import { t, getLocalizedEnemyName } from '../textManager.js';
import { enemyDisplayName } from '../../characters/enemy/enemyBasics.js';

const COMPONENTS = JSON.parse(DEX_TABLE_TEXT['Prefabs/1618_20.imported.json']).Components;
const BILLBOARD = COMPONENTS.find((c) => c.$type === 'DaggerfallBestiaryProject.BestiaryTrollCorpseBillboard');

/** The prefab's billboard, as the bundle serializes it: the body's picture, the ash's, the seconds before it rises. The
 *  ash stands by its centre, ASH_CENTRE over the body's foot (SetHealth: `-CorpseBillboardHeight / 2 + 0.1` from the
 *  body's centre). */
export const TROLL_CORPSE = Object.freeze({
  archive: BILLBOARD.Archive, record: BILLBOARD.Record, respawnTime: BILLBOARD.RespawnTime,
  ash: Object.freeze({ archive: BILLBOARD.AshArchive, record: BILLBOARD.AshRecord, centre: 0.1 }),
});
/** The prefab's SphereCollider - a trigger of radius 1 about the body's centre (Prefabs/1618_20.components.json). */
export const TROLL_TRIGGER_RADIUS = 1;
/** DaggerfallStats.SetDefaults - what a DaggerfallEntity's stats start at, and the corpse's stay at. */
const DEFAULT_STAT = 50;

/** The corpse's entity: BestiaryTrollCorpseEntity.SetEntityDefaults over a bare DaggerfallEntity - health 1 of 1, the
 *  dead troll's career (the custom career the mod's row names, as SetEntityDefaults looks it up), level 0. */
export function trollCorpseEntity(career) {
  const s = DEFAULT_STAT;
  return {
    isPlayer: false, isClass: false, level: 0, maxHealth: 1, health: 1, career: career ?? null, activeEffects: [], items: [],
    stats: { strength: s, intelligence: s, willpower: s, agility: s, endurance: s, personality: s, speed: s, luck: s },
  };
}

/** Each body still down that a save keeps: `key` (the host's) -> its prefab. */
const _down = new Map();
/** The times a load handed back for bodies not stood yet (a quickload restores the mod's record before the foes). */
const _pending = new Map();
let _vendor = null;

const cheat = () => _vendor != null && modSetting(_vendor, 'Cheat.DisableTrollRespawn') === true;

function makeTrollCorpse(f, host) {
  f.corpseDisabled = true;   // PostParentedSetup: no loot - every host's loot readers refuse a disabled body
  let entity = null, ended = false, rising = false;
  const key = host.key(f);
  const c = {
    respawnBuffer: TROLL_CORPSE.respawnTime,
    get entity() { return entity; },
    /** Still down: its foe still dead and lying in a live host (OnDestroy - a host frees a body by other roads too). */
    get down() { return !ended && f.corpsePrefab === c && !!f.dead && !!f.corpse && host.alive(); },
    /** Update: the countdown, where this machine runs the foe. */
    frame(dt) {
      if (ended || rising || !host.runs(f) || cheat()) return;
      c.respawnBuffer -= dt;
      if (c.respawnBuffer > 0) return;
      rising = true;
      Promise.resolve(host.rise(f)).then((stood) => {
        rising = false;
        if (ended) return;   // let go meanwhile (the host gone, a load)
        if (!stood) { c.respawnBuffer = TROLL_CORPSE.respawnTime; return; }
        end();
        host.say(t('dex.troll.recovered', 'The {name} has recovered from its injuries.', { name: getLocalizedEnemyName(f.mobileType, enemyDisplayName(f.mobileType)) }));
      });
    },
    /** The trigger a missile meets: about the body's centre (its flat's, once it stands - its foot until then). */
    sphere() {
      if (ended || rising) return null;
      const b = host.body(f);
      if (!b?.pos) return null;
      return { center: [b.pos[0], b.pos[1] + (b.size?.h ?? 0) / 2, b.pos[2]], radius: TROLL_TRIGGER_RADIUS };
    },
    /** A missile's bundle, assigned to the body's entity (EntityEffectManager.AssignBundle - its saves against the troll's
     *  career, its first round now). */
    struck(spell, casterLevel, caster) {
      if (ended || rising) return null;
      if (!host.runs(f)) { host.send(f, spell, casterLevel); return null; }   // DEX5b: a copy's - the bundle goes to the body its runner holds
      entity ??= trollCorpseEntity(f.entity?.career);
      const r = applySpell(spell, casterLevel, entity, sinks, Math.random, caster);
      if (entity.health <= 0) burn();
      return r;
    },
    /** The magic rounds the host's broker raised (OnNewMagicRound - every EntityEffectManager): a lasting effect's later
     *  rounds on the body. */
    rounds(from, to) {
      if (ended || rising || !entity?.activeEffects.length || !host.runs(f)) return;
      runMagicRoundsFor(entity, from, to, { sinks });
      if (entity.health <= 0) burn();
    },
    /** DEX5b: the runner's record says the body is gone - a copy loses it as the runner did (1 risen, 2 burnt). */
    gone(kind) {
      if (ended) return;
      end();
      if (kind === 2) host.toAsh(f, TROLL_CORPSE.ash);
      else host.vanish(f);
    },
    /** AUDIT DEX D2/D12: freed by another road (a load, the foe standing up again, its host gone) - no rise, no ash. */
    release() { end(); },
  };
  /** BestiaryTrollCorpseEntity.SetHealth's damage: DecreaseHealth, the one sink a harmful effect reaches. */
  const sinks = { hurt: (n) => { if (n > 0) entity.health = Math.max(0, entity.health - n); } };
  function end() {
    ended = true;
    if (key != null && _down.get(key) === c) _down.delete(key);
    if (f.corpsePrefab === c) f.corpsePrefab = null;
  }
  function burn() {
    if (ended) return;
    end();
    sayEnemyDied(host.say, f.mobileType);   // the corpse's entity knows its MobileID alone (GetLocalizedEnemyName(MobileID)) - no champion's name
    host.toAsh(f, TROLL_CORPSE.ash);
  }
  if (key != null) {
    _down.set(key, c);
    if (_pending.has(key)) { c.respawnBuffer = _pending.get(key); _pending.delete(key); }
  }
  return c;
}

/** The mod's save record: every body down with its time left (BestiarySaveData_v1.ActiveCorpses, by the port's key). */
export function trollSaveData() {
  const activeCorpses = [];
  for (const [key, c] of _down) {
    if (c.down) activeCorpses.push({ key, respawnBuffer: c.respawnBuffer });
    else _down.delete(key);
  }
  return { activeCorpses };
}
/** BestiarySaveInterface.RestoreSaveData: each body's time set again - now, where it lies already; when it is stood,
 *  where it does not yet. A body with no time left is skipped. */
export function restoreTrollSaveData(rec) {
  _pending.clear();
  for (const { key, respawnBuffer } of Array.isArray(rec?.activeCorpses) ? rec.activeCorpses : []) {
    if (typeof key !== 'string' || !Number.isFinite(respawnBuffer) || respawnBuffer <= 0) continue;
    const c = _down.get(key);
    if (c?.down) c.respawnBuffer = respawnBuffer;
    else _pending.set(key, respawnBuffer);
  }
}

let _installed = false;
/** While the mod is loaded, once: the prefab on the door and the record on DFU's mod save slot. */
export function installDexTroll(vendor) {
  if (_installed) return false;
  _installed = true;
  _vendor = vendor;
  registerCorpsePrefab(TROLL_CORPSE.archive, TROLL_CORPSE.record, makeTrollCorpse);
  registerModSaveData(vendor, { newSaveData: () => ({ activeCorpses: [] }), getSaveData: trollSaveData, restoreSaveData: restoreTrollSaveData });
  return true;
}
/** The test seam. */
export function _resetDexTroll() { _down.clear(); _pending.clear(); _vendor = null; _installed = false; }
