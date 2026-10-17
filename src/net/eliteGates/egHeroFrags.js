// @ts-check
// EG6c (2026-10-12, Mac authors them; bible/11-Multiplayer/Elite-Gates.md section 11.6 - "Authored hero fragments"): THE
// HERO FRAGMENTS' LAW HALVES - the one place a baked fragment's law is registered, read the way the relay reads it. Each is
// the JSON tools/fragBake.mjs writes from a fragment's Blender scene (section 11.5's record, net/eliteGates/egFragLaw.js), imported
// here and held at import to its reader (egFragRecordFault): a record with a fault never reaches a hall. Its mesh half is
// the client's, registered beside it in world/eliteGates/egHeroFragModel.js - the relay has no mesh and never reads one.
//
// THE REFERENCE (`egRefFrag`, variant 'reference') is the port's own stand-in, written by tools/egRefFragScene.mjs and baked
// by tools/bakeEgRefFrag.mjs: it proves the path every hero takes, and NO HALL LAYS IT (egHeroFragLaws leaves it out). Every
// other registered hero is LAID (EG-HERO-LAY, spec law 7 - net/eliteGates/egLaw.js heroHall): in a slot of its kit and class, on the hall's
// own hero die, where it fits. So this module and every law JSON it imports are in the relay's bundle (test/net/relayversion.test.js
// RELAY_GRAPH): a hero's law half is a relay version; its mesh half is not.
//
// To register one of Mac's: bake it (its own tools/bake<Name>.mjs, the reference's shape), import its law JSON here and add
// it to EG_HERO_FRAGS under its id. Not a DFU member. Ledger A (ELITE-GATES).
import { egFragRecordFault } from './egFragLaw.js';
import EG_REF_FRAG_LAW from '../../assets/egfrags/egRefFrag.law.json' with { type: 'json' };
// EG-HERO (the Soul Cairn, 2026-10-13): the Ossuary (a passage) and the Mist Stair (a shaft), written by the port in code -
// tools/egHeroOssuaryScene.mjs and tools/egHeroMistStairScene.mjs, baked by tools/bakeEgHeroOssuary.mjs and
// tools/bakeEgHeroMistStair.mjs (test/tooling/eghero_cairn.test.js)
import EG_HERO_OSSUARY_LAW from '../../assets/egfrags/egheroOssuary.law.json' with { type: 'json' };
import EG_HERO_MIST_STAIR_LAW from '../../assets/egfrags/egheroMistStair.law.json' with { type: 'json' };
// EG-HERO (2026-10-13, the owner: "You have to author the fragments"): the Shade Perilous's two heroes, authored in code
// (tools/egHeroGloamScene.mjs, tools/egHeroEclipseScene.mjs) and baked as Mac's would be - the Gloam Thicket's passage and
// the Eclipse Vault's chamber (test/tooling/eghero_shade.test.js).
import EG_HERO_GLOAM_LAW from '../../assets/egfrags/egheroGloam.law.json' with { type: 'json' };
import EG_HERO_ECLIPSE_LAW from '../../assets/egfrags/egheroEclipse.law.json' with { type: 'json' };
// EG-HERO (2026-10-13, Mac: "You have to author the fragments"): the Broken Galleries' three, authored in code by the port
// (tools/egHeroCavernsScene.mjs, egHeroStacksScene.mjs, egHeroColonnadeScene.mjs) and baked as Mac's would be
import EG_HERO_CAVERNS_LAW from '../../assets/egfrags/egheroCaverns.law.json' with { type: 'json' };
import EG_HERO_STACKS_LAW from '../../assets/egfrags/egheroStacks.law.json' with { type: 'json' };
import EG_HERO_COLONNADE_LAW from '../../assets/egfrags/egheroColonnade.law.json' with { type: 'json' };
// EG-HERO (2026-10-13, the owner: "You have to author the fragments"): the Havoc Wellhead's three - the Forge Gut (a
// passage), the Clan Pit and the Oblivion Caverns, deep (chambers) - written by tools/egHero*Scene.mjs, baked by their own
// tools/bakeEgHero*.mjs.
import EG_HERO_FORGE_GUT_LAW from '../../assets/egfrags/egheroForgeGut.law.json' with { type: 'json' };
import EG_HERO_CLAN_PIT_LAW from '../../assets/egfrags/egheroClanPit.law.json' with { type: 'json' };
import EG_HERO_DEEP_CAVERNS_LAW from '../../assets/egfrags/egheroDeepCaverns.law.json' with { type: 'json' };

/** The variant of the reference fragment - the stand-in no hall lays. */
export const EG_HERO_REFERENCE = 'reference';

/** A registry of law halves, by id: each held to the reader, frozen - or refused, naming the fragment and its faults. */
export function egHeroFragRegistry(laws) {
  return Object.freeze(Object.fromEntries(laws.map((law) => {
    const faults = egFragRecordFault(law);
    if (faults.length) throw new Error(`net/eliteGates/egHeroFrags.js: ${law?.id}'s law half is refused - ${faults.join('; ')}`);
    return [law.id, Object.freeze(law)];
  })));
}
/** EVERY BAKED FRAGMENT'S LAW HALF, by its id. */
export const EG_HERO_FRAGS = egHeroFragRegistry([
  EG_REF_FRAG_LAW,
  EG_HERO_OSSUARY_LAW,
  EG_HERO_MIST_STAIR_LAW,
  EG_HERO_GLOAM_LAW,
  EG_HERO_ECLIPSE_LAW,
  EG_HERO_CAVERNS_LAW,
  EG_HERO_STACKS_LAW,
  EG_HERO_COLONNADE_LAW,
  EG_HERO_FORGE_GUT_LAW,
  EG_HERO_CLAN_PIT_LAW,
  EG_HERO_DEEP_CAVERNS_LAW,
]);

/** The hero fragments of kit `kit` a hall may lay - every one of that kit registered (in `frags`, the registry by
 *  default) but the reference. */
export const egHeroFragLaws = (kit, frags = EG_HERO_FRAGS) => Object.values(frags).filter((law) => law.kit === kit && law.variant !== EG_HERO_REFERENCE);
