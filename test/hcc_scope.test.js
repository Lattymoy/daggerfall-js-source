// HCC (2026-09-23): WHAT IS AND IS NOT PORTED - the whole of TrailingWagon.dll, method by method.
//
// The mod's assembly is `TrailingWagon.dll` (vendored under vendor/horse-cart-and-cargo/ with its IL dumped by
// tools/ilDump.py to il/TrailingWagon.il.txt, the same way Eye Of The Beholder's was - test/eotb_scope.test.js is
// this file's model). The dump carries 444 method bodies; 46 are compiler-generated (constructors, the
// `<Start>d__161` coroutine's five, the `<>c` lambda classes' bodies, the event accessors) and are struck. What is
// left is 398 AUTHORED methods, every one a row below: `port` names the symbol carrying its arithmetic and the
// module it lives in, and a row with no port says WHY in a sentence starting "no twin here" - the port has no
// Unity transform, no Harmony, no ModManager message bus, no session-scoped texture release. There is no NOT DONE
// row. The dump is READ here: a row's method must be in it, and no authored method may be missing from the table.
//
// 338 of 398 are ported; 60 have no twin. The bible page (06-Systems/Horse-Cart-And-Cargo.md) states
// these numbers and the no-twin families, and a pin below holds it to them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');
const IL_DUMP = 'vendor/horse-cart-and-cargo/il/TrailingWagon.il.txt';

/** The module a row's `mod` names, by path. */
const MOD = {
  'horseCartLaw.js': 'src/systems/horseCartLaw.js',
  'horseFollow.js': 'src/systems/horseFollow.js',
  'horseCart.js': 'src/systems/horseCart.js',
  'wagon41214.js': 'src/systems/wagon41214.js',
  'horseCartPool.js': 'src/scenes/horseCartPool.js',
  'quat.js': 'src/world/quat.js',
  'world.js': 'src/scenes/world.js',
  'mountRig.js': 'src/player/mountRig.js',
  'inventorySession.js': 'src/systems/inventorySession.js',
  'nativeInventory.js': 'src/ui/nativeInventory.js',
  'dotnetResources.js': 'src/formats/dotnetResources.js',
};

/** THE 398. An overload shares its name with a `#2` suffix (HorseFollowPath::Seed twice). */
const IL = {
  // ── DeployedWagonActivator (2)
  'DeployedWagonActivator::Initialize': { port: 'attach', mod: 'horseCartPool.js' },
  'DeployedWagonActivator::Activate': { port: 'activate', mod: 'horseCartPool.js' },
  // ── DeployedWagonFollowerCollisionFilter (11)
  'DeployedWagonFollowerCollisionFilter::Initialize': { port: null, why: 'no twin here: the port\'s collider holds no bodies - Physics.IgnoreCollision between the parked wagon\'s box and an allied CharacterController has nothing to ignore; the horse\'s own probes skip the wagon\'s bucket instead (horseCartPool WAGON_BUCKET)' },
  'DeployedWagonFollowerCollisionFilter::OnEnable': { port: null, why: 'no twin here: the port\'s collider holds no bodies - Physics.IgnoreCollision between the parked wagon\'s box and an allied CharacterController has nothing to ignore; the horse\'s own probes skip the wagon\'s bucket instead (horseCartPool WAGON_BUCKET)' },
  'DeployedWagonFollowerCollisionFilter::Update': { port: null, why: 'no twin here: the port\'s collider holds no bodies - Physics.IgnoreCollision between the parked wagon\'s box and an allied CharacterController has nothing to ignore; the horse\'s own probes skip the wagon\'s bucket instead (horseCartPool WAGON_BUCKET)' },
  'DeployedWagonFollowerCollisionFilter::OnDisable': { port: null, why: 'no twin here: the port\'s collider holds no bodies - Physics.IgnoreCollision between the parked wagon\'s box and an allied CharacterController has nothing to ignore; the horse\'s own probes skip the wagon\'s bucket instead (horseCartPool WAGON_BUCKET)' },
  'DeployedWagonFollowerCollisionFilter::OnDestroy': { port: null, why: 'no twin here: the port\'s collider holds no bodies - Physics.IgnoreCollision between the parked wagon\'s box and an allied CharacterController has nothing to ignore; the horse\'s own probes skip the wagon\'s bucket instead (horseCartPool WAGON_BUCKET)' },
  'DeployedWagonFollowerCollisionFilter::RefreshCollisionPairs': { port: null, why: 'no twin here: the port\'s collider holds no bodies - Physics.IgnoreCollision between the parked wagon\'s box and an allied CharacterController has nothing to ignore; the horse\'s own probes skip the wagon\'s bucket instead (horseCartPool WAGON_BUCKET)' },
  'DeployedWagonFollowerCollisionFilter::IgnoreController': { port: null, why: 'no twin here: the port\'s collider holds no bodies - Physics.IgnoreCollision between the parked wagon\'s box and an allied CharacterController has nothing to ignore; the horse\'s own probes skip the wagon\'s bucket instead (horseCartPool WAGON_BUCKET)' },
  'DeployedWagonFollowerCollisionFilter::RestoreControllersThatAreNoLongerAllied': { port: null, why: 'no twin here: the port\'s collider holds no bodies - Physics.IgnoreCollision between the parked wagon\'s box and an allied CharacterController has nothing to ignore; the horse\'s own probes skip the wagon\'s bucket instead (horseCartPool WAGON_BUCKET)' },
  'DeployedWagonFollowerCollisionFilter::RestoreCollisionPairs': { port: null, why: 'no twin here: the port\'s collider holds no bodies - Physics.IgnoreCollision between the parked wagon\'s box and an allied CharacterController has nothing to ignore; the horse\'s own probes skip the wagon\'s bucket instead (horseCartPool WAGON_BUCKET)' },
  'DeployedWagonFollowerCollisionFilter::IsPlayerAlliedEnemy': { port: null, why: 'no twin here: the port\'s collider holds no bodies - Physics.IgnoreCollision between the parked wagon\'s box and an allied CharacterController has nothing to ignore; the horse\'s own probes skip the wagon\'s bucket instead (horseCartPool WAGON_BUCKET)' },
  'DeployedWagonFollowerCollisionFilter::ShouldIgnoreTeam': { port: null, why: 'no twin here: the port\'s collider holds no bodies - Physics.IgnoreCollision between the parked wagon\'s box and an allied CharacterController has nothing to ignore; the horse\'s own probes skip the wagon\'s bucket instead (horseCartPool WAGON_BUCKET)' },
  // ── DeployedWagonVisual (18)
  'DeployedWagonVisual::get_IsAlive': { port: 'isAlive', mod: 'horseCart.js' },
  'DeployedWagonVisual::get_IsGrounded': { port: 'isGrounded', mod: 'horseCart.js' },
  'DeployedWagonVisual::TryGetGroundedPose': { port: 'tryGetGroundedPose', mod: 'horseCart.js' },
  'DeployedWagonVisual::OwnsTransform': { port: null, why: 'no twin here: a Unity transform hierarchy; the port\'s visuals are numbers the pool draws, and their identity under the ray is a key (horseCartPool KEY_WAGON / KEY_HORSE)' },
  'DeployedWagonVisual::TryCreate': { port: 'updateDeployedPresentation', mod: 'horseCart.js' },
  'DeployedWagonVisual::Tick': { port: 'tick', mod: 'horseCart.js' },
  'DeployedWagonVisual::OwnsActivator': { port: 'KEY_WAGON', mod: 'horseCartPool.js' },
  'DeployedWagonVisual::ReleaseOwnedResources': { port: 'release', mod: 'horseCart.js' },
  'DeployedWagonVisual::Initialize': { port: 'DeployedWagonVisual', mod: 'horseCart.js' },
  'DeployedWagonVisual::TryApplyGrounding': { port: 'tryApplyGrounding', mod: 'horseCart.js' },
  'DeployedWagonVisual::TryProbeExternalGround': { port: 'probeExternalGround', mod: 'horseCart.js' },
  'DeployedWagonVisual::TrySolveTwoWheelPose': { port: 'solveTwoWheelPose', mod: 'horseCart.js' },
  'DeployedWagonVisual::CreateRotationFromBasis': { port: 'quatFromBasis', mod: 'quat.js' },
  'DeployedWagonVisual::SetProvisionalPose': { port: 'tryApplyGrounding', mod: 'horseCart.js' },
  'DeployedWagonVisual::ResetVisualLocalTransform': { port: null, why: 'no twin here: a Unity transform hierarchy; the port\'s visuals are numbers the pool draws, and their identity under the ray is a key (horseCartPool KEY_WAGON / KEY_HORSE)' },
  'DeployedWagonVisual::ResetStationaryWheelRotations': { port: 'drawWagon', mod: 'horseCartPool.js' },
  'DeployedWagonVisual::NormalizeHorizontalHeading': { port: 'normalizeHorizontalHeading', mod: 'horseCart.js' },
  'DeployedWagonVisual::EnsureUsableBoundsSize': { port: 'usableBounds', mod: 'wagon41214.js' },
  // ── FollowingWagonActivator (2)
  'FollowingWagonActivator::Initialize': { port: 'attach', mod: 'horseCartPool.js' },
  'FollowingWagonActivator::Activate': { port: 'activate', mod: 'horseCartPool.js' },
  // ── GroundSurfaceSelection (1)
  'GroundSurfaceSelection::IsPreferred': { port: 'isPreferredGround', mod: 'horseCartLaw.js' },
  // ── HorseCartAccessDecision (2)
  'HorseCartAccessDecision::Allow': { port: 'allow', mod: 'horseCart.js' },
  'HorseCartAccessDecision::Deny': { port: 'deny', mod: 'horseCart.js' },
  // ── HorseCartTransportActionResult (3)
  'HorseCartTransportActionResult::Success': { port: 'success', mod: 'horseCart.js' },
  'HorseCartTransportActionResult::Denied': { port: 'denied', mod: 'horseCart.js' },
  'HorseCartTransportActionResult::Unsupported': { port: 'unsupported', mod: 'horseCart.js' },
  // ── HorseCartCompatibilityApi (9)
  'HorseCartCompatibilityApi::CanAccessWagonStorage': { port: 'canAccessWagonStorage', mod: 'horseCart.js' },
  'HorseCartCompatibilityApi::CanUseTransport': { port: 'canUseTransport', mod: 'horseCart.js' },
  'HorseCartCompatibilityApi::TryUseTransport': { port: 'tryUseTransport', mod: 'horseCart.js' },
  'HorseCartCompatibilityApi::get_PhysicalPersistenceEnabled': { port: 'physicalPersistenceEnabled', mod: 'horseCart.js' },
  'HorseCartCompatibilityApi::ReceiveModMessage': { port: null, why: 'no twin here: DFU\'s ModManager mod-message bus (HorseCartCompatibilityApi.v1.*) - a port module that needs the runtime\'s word imports it (mountRig, inventorySession) instead of sending a message' },
  'HorseCartCompatibilityApi::TryParseStorageContext': { port: null, why: 'no twin here: DFU\'s ModManager mod-message bus (HorseCartCompatibilityApi.v1.*) - a port module that needs the runtime\'s word imports it (mountRig, inventorySession) instead of sending a message' },
  'HorseCartCompatibilityApi::TryParseTransport': { port: null, why: 'no twin here: DFU\'s ModManager mod-message bus (HorseCartCompatibilityApi.v1.*) - a port module that needs the runtime\'s word imports it (mountRig, inventorySession) instead of sending a message' },
  'HorseCartCompatibilityApi::CreateDecisionResponse': { port: null, why: 'no twin here: DFU\'s ModManager mod-message bus (HorseCartCompatibilityApi.v1.*) - a port module that needs the runtime\'s word imports it (mountRig, inventorySession) instead of sending a message' },
  'HorseCartCompatibilityApi::CreateActionResponse': { port: null, why: 'no twin here: DFU\'s ModManager mod-message bus (HorseCartCompatibilityApi.v1.*) - a port module that needs the runtime\'s word imports it (mountRig, inventorySession) instead of sending a message' },
  // ── HorseCartUiCompatibilityCoordinator (11)
  'HorseCartUiCompatibilityCoordinator::get_Mode': { port: null, why: 'no twin here: the sidecar coordinates Harmony patches over UncannyUI, Dragon Rider and Expanded Inventory\'s windows; none of those mods is in this port, whose own windows read the runtime through hooks (inventorySession openState / planWagonToggle, mountRig open)' },
  'HorseCartUiCompatibilityCoordinator::set_Mode': { port: null, why: 'no twin here: the sidecar coordinates Harmony patches over UncannyUI, Dragon Rider and Expanded Inventory\'s windows; none of those mods is in this port, whose own windows read the runtime through hooks (inventorySession openState / planWagonToggle, mountRig open)' },
  'HorseCartUiCompatibilityCoordinator::get_PreserveExternalTransportWindow': { port: null, why: 'no twin here: the sidecar coordinates Harmony patches over UncannyUI, Dragon Rider and Expanded Inventory\'s windows; none of those mods is in this port, whose own windows read the runtime through hooks (inventorySession openState / planWagonToggle, mountRig open)' },
  'HorseCartUiCompatibilityCoordinator::set_PreserveExternalTransportWindow': { port: null, why: 'no twin here: the sidecar coordinates Harmony patches over UncannyUI, Dragon Rider and Expanded Inventory\'s windows; none of those mods is in this port, whose own windows read the runtime through hooks (inventorySession openState / planWagonToggle, mountRig open)' },
  'HorseCartUiCompatibilityCoordinator::Resolve': { port: null, why: 'no twin here: the sidecar coordinates Harmony patches over UncannyUI, Dragon Rider and Expanded Inventory\'s windows; none of those mods is in this port, whose own windows read the runtime through hooks (inventorySession openState / planWagonToggle, mountRig open)' },
  'HorseCartUiCompatibilityCoordinator::Shutdown': { port: null, why: 'no twin here: the sidecar coordinates Harmony patches over UncannyUI, Dragon Rider and Expanded Inventory\'s windows; none of those mods is in this port, whose own windows read the runtime through hooks (inventorySession openState / planWagonToggle, mountRig open)' },
  'HorseCartUiCompatibilityCoordinator::ResolveSupportedDragonRiderAdapterRequirement': { port: null, why: 'no twin here: the sidecar coordinates Harmony patches over UncannyUI, Dragon Rider and Expanded Inventory\'s windows; none of those mods is in this port, whose own windows read the runtime through hooks (inventorySession openState / planWagonToggle, mountRig open)' },
  'HorseCartUiCompatibilityCoordinator::TryGetEnabledHarmonyMod': { port: null, why: 'no twin here: the sidecar coordinates Harmony patches over UncannyUI, Dragon Rider and Expanded Inventory\'s windows; none of those mods is in this port, whose own windows read the runtime through hooks (inventorySession openState / planWagonToggle, mountRig open)' },
  'HorseCartUiCompatibilityCoordinator::RequireExactEnabledModOrAbsent': { port: null, why: 'no twin here: the sidecar coordinates Harmony patches over UncannyUI, Dragon Rider and Expanded Inventory\'s windows; none of those mods is in this port, whose own windows read the runtime through hooks (inventorySession openState / planWagonToggle, mountRig open)' },
  'HorseCartUiCompatibilityCoordinator::ResolveSupportedUncannyUiAdapterVariant': { port: null, why: 'no twin here: the sidecar coordinates Harmony patches over UncannyUI, Dragon Rider and Expanded Inventory\'s windows; none of those mods is in this port, whose own windows read the runtime through hooks (inventorySession openState / planWagonToggle, mountRig open)' },
  'HorseCartUiCompatibilityCoordinator::TryUninstall': { port: null, why: 'no twin here: the sidecar coordinates Harmony patches over UncannyUI, Dragon Rider and Expanded Inventory\'s windows; none of those mods is in this port, whose own windows read the runtime through hooks (inventorySession openState / planWagonToggle, mountRig open)' },
  // ── HorseFollowController (32)
  'HorseFollowController::get_IsInitialized': { port: 'isInitialized', mod: 'horseFollow.js' },
  'HorseFollowController::get_IsCombatEvading': { port: 'isCombatEvading', mod: 'horseFollow.js' },
  'HorseFollowController::get_Position': { port: 'position', mod: 'horseFollow.js' },
  'HorseFollowController::get_Heading': { port: 'heading', mod: 'horseFollow.js' },
  'HorseFollowController::get_ActualHorizontalSpeed': { port: 'actualHorizontalSpeed', mod: 'horseFollow.js' },
  'HorseFollowController::set_ActualHorizontalSpeed': { port: 'actualHorizontalSpeed', mod: 'horseFollow.js' },
  'HorseFollowController::Begin': { port: 'begin', mod: 'horseFollow.js' },
  'HorseFollowController::ResetTransient': { port: 'resetTransient', mod: 'horseFollow.js' },
  'HorseFollowController::ClearCombatEvasion': { port: 'clearCombatEvasion', mod: 'horseFollow.js' },
  'HorseFollowController::Tick': { port: 'tick', mod: 'horseFollow.js' },
  'HorseFollowController::IsQualifyingThreatState': { port: 'isQualifyingThreatState', mod: 'horseFollow.js' },
  'HorseFollowController::CalculateFollowSpeed': { port: 'calculateFollowSpeed', mod: 'horseFollow.js' },
  'HorseFollowController::CalculateObservedPlayerSpeed': { port: 'observedPlayerSpeed', mod: 'horseFollow.js' },
  'HorseFollowController::CalculateAcceleratedFollowSpeed': { port: 'acceleratedFollowSpeed', mod: 'horseFollow.js' },
  'HorseFollowController::ShouldEnterCombatEvasion': { port: 'shouldEnterCombatEvasion', mod: 'horseFollow.js' },
  'HorseFollowController::TryFindGround': { port: 'tryFindGround', mod: 'horseFollow.js' },
  'HorseFollowController::IsPreferredGroundSurface': { port: 'isPreferredGround', mod: 'horseCartLaw.js' },
  'HorseFollowController::UpdateCombatState': { port: 'updateCombatState', mod: 'horseFollow.js' },
  'HorseFollowController::CollectThreats': { port: 'hccThreats', mod: 'world.js' },
  'HorseFollowController::SelectOrRetainEvadeTarget': { port: 'selectOrRetainEvadeTarget', mod: 'horseFollow.js' },
  'HorseFollowController::IsThreatSafe': { port: 'isThreatSafe', mod: 'horseFollow.js' },
  'HorseFollowController::UpdateStuckRecovery': { port: 'updateStuckRecovery', mod: 'horseFollow.js' },
  'HorseFollowController::TryChooseGroundedStep': { port: 'tryChooseGroundedStep', mod: 'horseFollow.js' },
  'HorseFollowController::MoveGroundedInSubsteps': { port: 'moveGroundedInSubsteps', mod: 'horseFollow.js' },
  'HorseFollowController::IsStepClear': { port: 'isStepClear', mod: 'horseFollow.js' },
  'HorseFollowController::IsDirectPathClear': { port: 'isDirectPathClear', mod: 'horseFollow.js' },
  'HorseFollowController::IsIgnoredCollider': { port: 'WAGON_BUCKET', mod: 'horseCartPool.js' },
  'HorseFollowController::CalculateSpeed': { port: 'calculateFollowSpeed', mod: 'horseFollow.js' },
  'HorseFollowController::ResetProgress': { port: 'resetProgress', mod: 'horseFollow.js' },
  'HorseFollowController::GetPlayerMovement': { port: 'movement', mod: 'horseCart.js' },
  'HorseFollowController::NormalizeHorizontal': { port: 'normalizeHorizontal', mod: 'horseFollow.js' },
  'HorseFollowController::HorizontalDistance': { port: 'horizontalDistance', mod: 'horseCartLaw.js' },
  // ── HorseFollowPath (9)
  'HorseFollowPath::get_Count': { port: 'count', mod: 'horseFollow.js' },
  'HorseFollowPath::Clear': { port: 'clear', mod: 'horseFollow.js' },
  'HorseFollowPath::Seed': { port: 'seed', mod: 'horseFollow.js' },
  'HorseFollowPath::Seed#2': { port: 'seedBehind', mod: 'horseFollow.js' },
  'HorseFollowPath::Record': { port: 'record', mod: 'horseFollow.js' },
  'HorseFollowPath::TryGetPointBehind': { port: 'tryGetPointBehind', mod: 'horseFollow.js' },
  'HorseFollowPath::Prune': { port: 'prune', mod: 'horseFollow.js' },
  'HorseFollowPath::NormalizeHorizontal': { port: 'normalizeHorizontal', mod: 'horseFollow.js' },
  'HorseFollowPath::HorizontalDistance': { port: 'horizontalDistance', mod: 'horseCartLaw.js' },
  // ── HorseNameTooltipController (5)
  'HorseNameTooltipController::Update': { port: 'hoverName', mod: 'horseCartPool.js' },
  'HorseNameTooltipController::TryGetActivationRay': { port: null, why: 'no twin here: the mod\'s HUD TextLabel; the port\'s plaque is ui/worldPlaque.js\'s, fed by horseCartPool hoverName through the host\'s namer ladder' },
  'HorseNameTooltipController::EnsureBound': { port: null, why: 'no twin here: the mod\'s HUD TextLabel; the port\'s plaque is ui/worldPlaque.js\'s, fed by horseCartPool hoverName through the host\'s namer ladder' },
  'HorseNameTooltipController::Hide': { port: null, why: 'no twin here: the mod\'s HUD TextLabel; the port\'s plaque is ui/worldPlaque.js\'s, fed by horseCartPool hoverName through the host\'s namer ladder' },
  'HorseNameTooltipController::Release': { port: null, why: 'no twin here: the mod\'s HUD TextLabel; the port\'s plaque is ui/worldPlaque.js\'s, fed by horseCartPool hoverName through the host\'s namer ladder' },
  // ── HorseTextureSet (5)
  'HorseTextureSet::TryLoad': { port: 'ensureStationary', mod: 'horseCartPool.js' },
  'HorseTextureSet::GetTexture': { port: 'horseStillRecord', mod: 'horseCartPool.js' },
  'HorseTextureSet::ReleaseOwnedResources': { port: null, why: 'no twin here: uploadTexture\'s cache is session-long by the renderer\'s own law (renderer.js AUDIT 19 F10); nothing frees a world texture' },
  'HorseTextureSet::LoadAll': { port: 'ensureStationary', mod: 'horseCartPool.js' },
  'HorseTextureSet::ReadResource': { port: 'readManifestResources', mod: 'dotnetResources.js' },
  // ── HorseWalkAnimationSet (5)
  'HorseWalkAnimationSet::TryLoad': { port: 'ensureWalk', mod: 'horseCartPool.js' },
  'HorseWalkAnimationSet::GetTexture': { port: 'horseWalkRecord', mod: 'horseCartPool.js' },
  'HorseWalkAnimationSet::ReleaseOwnedResources': { port: null, why: 'no twin here: uploadTexture\'s cache is session-long by the renderer\'s own law (renderer.js AUDIT 19 F10); nothing frees a world texture' },
  'HorseWalkAnimationSet::LoadAll': { port: 'ensureWalk', mod: 'horseCartPool.js' },
  'HorseWalkAnimationSet::ReadResource': { port: 'readManifestResources', mod: 'dotnetResources.js' },
  // ── StationaryHorseActivator (2)
  'StationaryHorseActivator::Initialize': { port: 'attach', mod: 'horseCartPool.js' },
  'StationaryHorseActivator::Activate': { port: 'activate', mod: 'horseCartPool.js' },
  // ── StationaryHorseBillboard (9)
  'StationaryHorseBillboard::Initialize': { port: 'horseBatch', mod: 'horseCartPool.js' },
  'StationaryHorseBillboard::SetMotionSpeed': { port: 'motionSpeed', mod: 'horseCart.js' },
  'StationaryHorseBillboard::LateUpdate': { port: 'stepWalk', mod: 'horseCart.js' },
  'StationaryHorseBillboard::ApplyOrientation': { port: 'poseHorseBatch', mod: 'horseCartPool.js' },
  'StationaryHorseBillboard::CalculateAnimationFramesPerSecond': { port: 'walkFramesPerSecond', mod: 'horseCartLaw.js' },
  'StationaryHorseBillboard::CalculateIdleFrame': { port: 'idleFrame', mod: 'horseCartLaw.js' },
  'StationaryHorseBillboard::CalculateOrientation': { port: 'calculateHorseOrientation', mod: 'horseCartLaw.js' },
  'StationaryHorseBillboard::TryGetView': { port: 'horseViewFor', mod: 'horseCartLaw.js' },
  'StationaryHorseBillboard::CreateUvs': { port: 'poseHorseBatch', mod: 'horseCartPool.js' },
  // ── StationaryHorseVisual (16)
  'StationaryHorseVisual::get_IsAlive': { port: 'isAlive', mod: 'horseCart.js' },
  'StationaryHorseVisual::get_IsInteractive': { port: 'isInteractive', mod: 'horseCart.js' },
  'StationaryHorseVisual::TryGetGroundedPose': { port: 'tryGetGroundedPose', mod: 'horseCart.js' },
  'StationaryHorseVisual::TryCreate': { port: 'updateStationaryHorsePresentation', mod: 'horseCart.js' },
  'StationaryHorseVisual::Tick': { port: 'tick', mod: 'horseCart.js' },
  'StationaryHorseVisual::OwnsActivator': { port: 'KEY_HORSE', mod: 'horseCartPool.js' },
  'StationaryHorseVisual::OwnsTransform': { port: null, why: 'no twin here: a Unity transform hierarchy; the port\'s visuals are numbers the pool draws, and their identity under the ray is a key (horseCartPool KEY_WAGON / KEY_HORSE)' },
  'StationaryHorseVisual::get_Parent': { port: null, why: 'no twin here: a Unity transform hierarchy; the port\'s visuals are numbers the pool draws, and their identity under the ray is a key (horseCartPool KEY_WAGON / KEY_HORSE)' },
  'StationaryHorseVisual::Reparent': { port: 'offset', mod: 'horseCart.js' },
  'StationaryHorseVisual::ApplyFollowingPose': { port: 'applyFollowingPose', mod: 'horseCart.js' },
  'StationaryHorseVisual::ReleaseOwnedResources': { port: 'release', mod: 'horseCart.js' },
  'StationaryHorseVisual::Initialize': { port: 'StationaryHorseVisual', mod: 'horseCart.js' },
  'StationaryHorseVisual::TryApplyGrounding': { port: 'tryApplyGrounding', mod: 'horseCart.js' },
  'StationaryHorseVisual::IsRejectedGroundHit': { port: 'raycastAllOver', mod: 'horseCartPool.js' },
  'StationaryHorseVisual::NormalizeHorizontal': { port: 'normalizeHorizontalHeading', mod: 'horseCart.js' },
  'StationaryHorseVisual::HorizontalDistanceSquared': { port: 'tick', mod: 'horseCart.js' },
  // ── TrailingWagonRuntime (205)
  'TrailingWagonRuntime::get_SaveDataType': { port: null, why: 'no twin here: DFU\'s SaveDataInterface type token; the record rides the envelope as `horseCart` (world.js)' },
  'TrailingWagonRuntime::TryGetInstance': { port: 'hccRuntimeOn', mod: 'world.js' },
  'TrailingWagonRuntime::get_PhysicalPersistenceEnabled': { port: 'physicalPersistenceEnabled', mod: 'horseCart.js' },
  'TrailingWagonRuntime::get_HorseFollowDistance': { port: 'horseFollowDistance', mod: 'horseCart.js' },
  'TrailingWagonRuntime::get_ShowTrailingWagon': { port: 'showTrailingWagon', mod: 'horseCart.js' },
  'TrailingWagonRuntime::get_HorseName': { port: 'horseName', mod: 'horseCart.js' },
  'TrailingWagonRuntime::get_HorseTargetLabel': { port: 'horseTargetLabel', mod: 'horseCartLaw.js' },
  'TrailingWagonRuntime::get_HasHorseName': { port: 'hasHorseName', mod: 'horseCart.js' },
  'TrailingWagonRuntime::get_AvoidCombat': { port: 'avoidCombat', mod: 'horseCart.js' },
  'TrailingWagonRuntime::get_InteriorWagonAccessDistance': { port: 'interiorWagonAccessDistance', mod: 'horseCart.js' },
  'TrailingWagonRuntime::get_FollowingTransportFastTravels': { port: 'followingTransportFastTravels', mod: 'horseCart.js' },
  'TrailingWagonRuntime::Init': { port: 'createHorseCartRuntime', mod: 'horseCart.js' },
  'TrailingWagonRuntime::Initialize': { port: 'createHorseCartRuntime', mod: 'horseCart.js' },
  'TrailingWagonRuntime::Start': { port: 'createHorseCartRuntime', mod: 'horseCart.js' },
  'TrailingWagonRuntime::ShouldMigrateLegacySaveFile': { port: 'shouldMigrateLegacySaveFile', mod: 'horseCartLaw.js' },
  'TrailingWagonRuntime::MigrateLegacySaveDataFiles': { port: null, why: 'no twin here: the mod\'s pre-rc save files under DFU\'s Saves folder; the port\'s record has only ever been the envelope\'s (world.js `horseCart`), so there is nothing to migrate' },
  'TrailingWagonRuntime::HandleSettingsChanged': { port: 'handleSettingsChanged', mod: 'horseCart.js' },
  'TrailingWagonRuntime::ClampHorseFollowDistance': { port: 'clampHorseFollowDistance', mod: 'horseCart.js' },
  'TrailingWagonRuntime::ClampInteriorWagonAccessDistance': { port: 'clampInteriorWagonAccessDistance', mod: 'horseCart.js' },
  'TrailingWagonRuntime::IsWithinInteriorEntranceDistance': { port: 'isWithinInteriorEntranceDistance', mod: 'horseCart.js' },
  'TrailingWagonRuntime::ParseConfiguredHotkey': { port: 'parseConfiguredHotkey', mod: 'horseCart.js' },
  'TrailingWagonRuntime::ApplyPendingPersistenceWork': { port: 'applyPendingPersistenceWork', mod: 'horseCart.js' },
  'TrailingWagonRuntime::DisablePersistenceAndRecall': { port: 'applyPendingPersistenceWork', mod: 'horseCart.js' },
  'TrailingWagonRuntime::EnablePersistenceFromCurrentPlayerState': { port: 'applyPendingPersistenceWork', mod: 'horseCart.js' },
  'TrailingWagonRuntime::ClearPhysicalPersistenceTransientState': { port: 'clearPhysicalPersistenceTransientState', mod: 'horseCart.js' },
  'TrailingWagonRuntime::ApplyPersistenceResolution': { port: 'applyPersistenceResolution', mod: 'horseCart.js' },
  'TrailingWagonRuntime::ResolvePersistenceDisabledState': { port: 'resolvePersistenceDisabledState', mod: 'horseCart.js' },
  'TrailingWagonRuntime::ResolvePersistenceEnabledState': { port: 'resolvePersistenceEnabledState', mod: 'horseCart.js' },
  'TrailingWagonRuntime::IsHorseTransportAvailable': { port: 'isHorseTransportAvailable', mod: 'horseCartLaw.js' },
  'TrailingWagonRuntime::IsCartTransportAvailable': { port: 'isCartTransportAvailable', mod: 'horseCartLaw.js' },
  'TrailingWagonRuntime::IsWagonInventoryAccessible': { port: 'isWagonInventoryAccessible', mod: 'horseCart.js' },
  'TrailingWagonRuntime::IsDungeonExitWagonAccessAllowed': { port: 'isDungeonExitWagonAccessAllowed', mod: 'horseCart.js' },
  'TrailingWagonRuntime::InteriorAccessRequiresMapPixelMatch': { port: 'interiorAccessRequiresMapPixelMatch', mod: 'horseCart.js' },
  'TrailingWagonRuntime::IsUsableDungeonEntranceDoorPosition': { port: 'isUsableDungeonEntranceDoorPosition', mod: 'horseCart.js' },
  'TrailingWagonRuntime::LateUpdate': { port: 'lateUpdate', mod: 'horseCart.js' },
  'TrailingWagonRuntime::IsHitchedTeamFollowing': { port: 'isHitchedTeamFollowing', mod: 'horseCart.js' },
  'TrailingWagonRuntime::IsAutonomousHorseFollowing': { port: 'isAutonomousHorseFollowing', mod: 'horseCart.js' },
  'TrailingWagonRuntime::UpdateMovingPresentation': { port: 'updateMovingPresentation', mod: 'horseCart.js' },
  'TrailingWagonRuntime::UpdateFollowingWagonPresentation': { port: 'updateFollowingWagonPresentation', mod: 'horseCart.js' },
  'TrailingWagonRuntime::EnsureFollowingWagonInteraction': { port: 'updateFollowingWagonPresentation', mod: 'horseCart.js' },
  'TrailingWagonRuntime::CacheFollowingWagonWorldPose': { port: 'cacheFollowingWagonWorldPose', mod: 'horseCart.js' },
  'TrailingWagonRuntime::TryGetGameManager': { port: 'ready', mod: 'horseCart.js' },
  'TrailingWagonRuntime::ShouldShowMovingWagon': { port: 'shouldShowMovingWagon', mod: 'horseCart.js' },
  'TrailingWagonRuntime::GetMovementTransform': { port: 'movement', mod: 'horseCart.js' },
  'TrailingWagonRuntime::CreateWagonVisual': { port: 'createWagonVisual', mod: 'horseCart.js' },
  'TrailingWagonRuntime::UpdateCargoFullness': { port: 'updateCargoFullness', mod: 'horseCart.js' },
  'TrailingWagonRuntime::DisableInteraction': { port: null, why: 'no twin here: the drawn meshes never enter the collider - the only collider the port stands is the parked wagon\'s deliberate box (horseCartPool standWagonCollider), so there are no child colliders, rigidbodies or layers to disable' },
  'TrailingWagonRuntime::SetLayerRecursively': { port: null, why: 'no twin here: Unity layers; the ray\'s exclusions are the collider\'s bucket filter (horseCartPool WAGON_BUCKET)' },
  'TrailingWagonRuntime::IsDiscontinuity': { port: 'isDiscontinuity', mod: 'horseFollow.js' },
  'TrailingWagonRuntime::SeedTrail': { port: 'seed', mod: 'horseFollow.js' },
  'TrailingWagonRuntime::RecordPlayerMovement': { port: 'record', mod: 'horseFollow.js' },
  'TrailingWagonRuntime::PruneTrail': { port: 'prune', mod: 'horseFollow.js' },
  'TrailingWagonRuntime::TryGetTrailingPoint': { port: 'trailingPoint', mod: 'horseFollow.js' },
  'TrailingWagonRuntime::ApplyGroundedPose': { port: 'groundedPoseStep', mod: 'horseFollow.js' },
  'TrailingWagonRuntime::UpdateWheelAnimation': { port: 'updateWheelAnimation', mod: 'horseCart.js' },
  'TrailingWagonRuntime::CalculateSignedLongitudinalTravel': { port: 'signedLongitudinalTravel', mod: 'horseCartLaw.js' },
  'TrailingWagonRuntime::CalculateWheelRotationDegrees': { port: 'wheelRotationDegrees', mod: 'horseCartLaw.js' },
  'TrailingWagonRuntime::WrapWheelAngle': { port: 'wrapWheelAngle', mod: 'horseCartLaw.js' },
  'TrailingWagonRuntime::ApplyWheelRotation': { port: 'wheelMatrix', mod: 'horseCartPool.js' },
  'TrailingWagonRuntime::ResetWheelMotionState': { port: 'resetWheelMotionState', mod: 'horseCart.js' },
  'TrailingWagonRuntime::GetHorizontalForward': { port: 'horizontalForward', mod: 'horseCartLaw.js' },
  'TrailingWagonRuntime::ReconcileCartOwnership': { port: 'reconcileCartOwnership', mod: 'horseCart.js' },
  'TrailingWagonRuntime::ReconcileHorseOwnership': { port: 'reconcileHorseOwnership', mod: 'horseCart.js' },
  'TrailingWagonRuntime::ObserveTransportMode': { port: 'observeTransportMode', mod: 'horseCart.js' },
  'TrailingWagonRuntime::ObserveTransportModeWithoutPersistence': { port: 'observeTransportMode', mod: 'horseCart.js' },
  'TrailingWagonRuntime::RememberValidNonCartMode': { port: 'rememberValidNonCartMode', mod: 'horseCart.js' },
  'TrailingWagonRuntime::RejectTransportChange': { port: 'rejectTransportChange', mod: 'horseCart.js' },
  'TrailingWagonRuntime::SetTransportMode': { port: 'setTransportMode', mod: 'horseCart.js' },
  'TrailingWagonRuntime::RememberLastMount': { port: 'rememberLastMount', mod: 'horseCart.js' },
  'TrailingWagonRuntime::ScheduleDirectCartTransportRefresh': { port: 'scheduleDirectCartTransportRefresh', mod: 'horseCart.js' },
  'TrailingWagonRuntime::UpdatePendingTransportModeRefresh': { port: 'updatePendingTransportModeRefresh', mod: 'horseCart.js' },
  'TrailingWagonRuntime::ClearPendingTransportModeRefresh': { port: 'clearPendingTransportModeRefresh', mod: 'horseCart.js' },
  'TrailingWagonRuntime::CanRefreshDirectCartTransport': { port: 'canRefreshDirectCartTransport', mod: 'horseCart.js' },
  'TrailingWagonRuntime::HandleConfiguredHotkeys': { port: 'handleConfiguredHotkeys', mod: 'horseCart.js' },
  'TrailingWagonRuntime::HandleQuickMountOrDismount': { port: 'handleQuickMountOrDismount', mod: 'horseCart.js' },
  'TrailingWagonRuntime::ResolveQuickMountMode': { port: 'resolveQuickMountMode', mod: 'horseCart.js' },
  'TrailingWagonRuntime::HandleSummonTransport': { port: 'handleSummonTransport', mod: 'horseCart.js' },
  'TrailingWagonRuntime::TryPrepareCartMount': { port: 'tryPrepareCartMount', mod: 'horseCart.js' },
  'TrailingWagonRuntime::TryPrepareHorseMount': { port: 'tryPrepareHorseMount', mod: 'horseCart.js' },
  'TrailingWagonRuntime::CanMountHorseFromTransportWindow': { port: 'canMountHorseFromTransportWindow', mod: 'horseCart.js' },
  'TrailingWagonRuntime::CanUseTransport': { port: 'canUseTransport', mod: 'horseCart.js' },
  'TrailingWagonRuntime::CanUseHorseTransport': { port: 'canUseHorseTransport', mod: 'horseCart.js' },
  'TrailingWagonRuntime::HandleHorseTransportButton': { port: 'handleHorseTransportButton', mod: 'horseCart.js' },
  'TrailingWagonRuntime::TryUseTransport': { port: 'tryUseTransport', mod: 'horseCart.js' },
  'TrailingWagonRuntime::TryUseHorseTransport': { port: 'tryUseHorseTransport', mod: 'horseCart.js' },
  'TrailingWagonRuntime::CanUseCartFromTransportWindow': { port: 'canUseCartFromTransportWindow', mod: 'horseCart.js' },
  'TrailingWagonRuntime::CanUseCartTransport': { port: 'canUseCartTransport', mod: 'horseCart.js' },
  'TrailingWagonRuntime::HandleCartTransportButton': { port: 'handleCartTransportButton', mod: 'horseCart.js' },
  'TrailingWagonRuntime::TryUseCartTransport': { port: 'tryUseCartTransport', mod: 'horseCart.js' },
  'TrailingWagonRuntime::DenyTransportAction': { port: 'denyTransportAction', mod: 'horseCart.js' },
  'TrailingWagonRuntime::CanMountNearbyDeployedCart': { port: 'canMountNearbyDeployedCart', mod: 'horseCart.js' },
  'TrailingWagonRuntime::DetachFollowingTeamAndRideHorse': { port: 'detachFollowingTeamAndRideHorse', mod: 'horseCart.js' },
  'TrailingWagonRuntime::IsPhysicalTeamWithinMountDistances': { port: 'isPhysicalTeamWithinMountDistances', mod: 'horseCart.js' },
  'TrailingWagonRuntime::IsHorseCloseEnoughToHitch': { port: 'isHorseCloseEnoughToHitch', mod: 'horseCart.js' },
  'TrailingWagonRuntime::BeginRidingHorse': { port: 'beginRidingHorse', mod: 'horseCart.js' },
  'TrailingWagonRuntime::DeployWagonBeforeHorseTravel': { port: 'deployWagonBeforeHorseTravel', mod: 'horseCart.js' },
  'TrailingWagonRuntime::TryGetHorseScenePosition': { port: 'tryGetHorseScenePosition', mod: 'horseCart.js' },
  'TrailingWagonRuntime::DeployHorseBehindPlayer': { port: 'deployHorseBehindPlayer', mod: 'horseCart.js' },
  'TrailingWagonRuntime::SetHorseLooseAtWagonHitch': { port: 'setHorseLooseAtWagonHitch', mod: 'horseCart.js' },
  'TrailingWagonRuntime::SetHorseLoose': { port: 'setHorseLoose', mod: 'horseCart.js' },
  'TrailingWagonRuntime::SetHorseFollowing': { port: 'setHorseFollowing', mod: 'horseCart.js' },
  'TrailingWagonRuntime::SetHorseWithPlayer': { port: 'setHorseWithPlayer', mod: 'horseCart.js' },
  'TrailingWagonRuntime::SetHorseHitchedToWagon': { port: 'setHorseHitchedToWagon', mod: 'horseCart.js' },
  'TrailingWagonRuntime::SetHorseNone': { port: 'setHorseNone', mod: 'horseCart.js' },
  'TrailingWagonRuntime::ApplyLocalOffsetToWorld': { port: 'applyLocalOffsetToWorld', mod: 'horseCartLaw.js' },
  'TrailingWagonRuntime::GetHorizontalRight': { port: 'horizontalRight', mod: 'horseCartLaw.js' },
  'TrailingWagonRuntime::HorizontalDistance': { port: 'horizontalDistance', mod: 'horseCartLaw.js' },
  'TrailingWagonRuntime::IsWithinHorizontalDistance': { port: 'isWithinHorizontalDistance', mod: 'horseCartLaw.js' },
  'TrailingWagonRuntime::IsPhysicalTransportStateValid': { port: 'isPhysicalTransportStateValid', mod: 'horseCart.js' },
  'TrailingWagonRuntime::CacheMovingWorldPose': { port: 'cacheMovingWorldPose', mod: 'horseCart.js' },
  'TrailingWagonRuntime::DeployFromBestAvailablePose': { port: 'deployFromBestAvailablePose', mod: 'horseCart.js' },
  'TrailingWagonRuntime::CaptureBestAvailableDeploymentPose': { port: 'captureBestAvailableDeploymentPose', mod: 'horseCart.js' },
  'TrailingWagonRuntime::CommitDeployment': { port: 'commitDeployment', mod: 'horseCart.js' },
  'TrailingWagonRuntime::UpdateDeployedPresentation': { port: 'updateDeployedPresentation', mod: 'horseCart.js' },
  'TrailingWagonRuntime::UpdateStationaryHorsePresentation': { port: 'updateStationaryHorsePresentation', mod: 'horseCart.js' },
  'TrailingWagonRuntime::UpdateFollowingHorse': { port: 'updateFollowingHorse', mod: 'horseCart.js' },
  'TrailingWagonRuntime::CacheFollowingHorseWorldPose': { port: 'cacheFollowingHorseWorldPose', mod: 'horseCart.js' },
  'TrailingWagonRuntime::TryGetFollowingHorseScene': { port: 'tryGetFollowingHorseScene', mod: 'horseCart.js' },
  'TrailingWagonRuntime::EnsureHorseTextures': { port: 'ensureHorseTextures', mod: 'horseCart.js' },
  'TrailingWagonRuntime::EnsureHorseWalkTextures': { port: 'ensureHorseWalkTextures', mod: 'horseCart.js' },
  'TrailingWagonRuntime::TryCompleteFastTravelHorseRelocation': { port: 'tryCompleteFastTravelHorseRelocation', mod: 'horseCart.js' },
  'TrailingWagonRuntime::TryGetRelevantDeployedScene': { port: 'tryGetRelevantDeployedScene', mod: 'horseCart.js' },
  'TrailingWagonRuntime::TryGetPhysicalWagonScene': { port: 'tryGetPhysicalWagonScene', mod: 'horseCart.js' },
  'TrailingWagonRuntime::TryGetRelevantSavedWorldScene': { port: 'tryGetRelevantSavedWorldScene', mod: 'horseCart.js' },
  'TrailingWagonRuntime::GetSavedHeading': { port: 'savedHeading', mod: 'horseCart.js' },
  'TrailingWagonRuntime::GetSavedHorseHeading': { port: 'savedHorseHeading', mod: 'horseCart.js' },
  'TrailingWagonRuntime::ConvertSceneToWorld': { port: 'sceneToWorld', mod: 'horseCartLaw.js' },
  'TrailingWagonRuntime::ConvertWorldToScene': { port: 'worldToScene', mod: 'horseCartLaw.js' },
  'TrailingWagonRuntime::CastWorldCoordinate': { port: 'castWorldCoordinate', mod: 'horseCartLaw.js' },
  'TrailingWagonRuntime::OwnsStationaryHorseActivator': { port: 'ownsStationaryHorseActivator', mod: 'horseCart.js' },
  'TrailingWagonRuntime::FormatHorseSubject': { port: 'formatHorseSubject', mod: 'horseCart.js' },
  'TrailingWagonRuntime::FormatHorseAndWagonSubject': { port: 'formatHorseAndWagonSubject', mod: 'horseCart.js' },
  'TrailingWagonRuntime::GetHorseSubject': { port: 'horseSubject', mod: 'horseCart.js' },
  'TrailingWagonRuntime::GetHorseAndWagonSubject': { port: 'horseAndWagonSubject', mod: 'horseCart.js' },
  'TrailingWagonRuntime::GetHorseObject': { port: 'horseObject', mod: 'horseCart.js' },
  'TrailingWagonRuntime::OpenHorseNamePrompt': { port: 'openHorseNamePrompt', mod: 'horseCart.js' },
  'TrailingWagonRuntime::HorseNameInput_OnGotUserInput': { port: 'openHorseNamePrompt', mod: 'horseCart.js' },
  'TrailingWagonRuntime::RefreshHorseNameInputState': { port: 'refreshHorseNameInputState', mod: 'horseCart.js' },
  'TrailingWagonRuntime::OpenWagonInventoryFromPhysicalActivation': { port: 'openWagonInventoryFromPhysicalActivation', mod: 'horseCart.js' },
  'TrailingWagonRuntime::CloseHorseNameInput': { port: 'closeHorseNameInput', mod: 'horseCart.js' },
  'TrailingWagonRuntime::HandleDeployedWagonActivation': { port: 'handleDeployedWagonActivation', mod: 'horseCart.js' },
  'TrailingWagonRuntime::HandleFollowingWagonActivation': { port: 'handleFollowingWagonActivation', mod: 'horseCart.js' },
  'TrailingWagonRuntime::HandleStationaryHorseActivation': { port: 'handleStationaryHorseActivation', mod: 'horseCart.js' },
  'TrailingWagonRuntime::StartFollowingHorse': { port: 'startFollowingHorse', mod: 'horseCart.js' },
  'TrailingWagonRuntime::StopFollowingHorse': { port: 'stopFollowingHorse', mod: 'horseCart.js' },
  'TrailingWagonRuntime::StartFollowingHitchedTeam': { port: 'startFollowingHitchedTeam', mod: 'horseCart.js' },
  'TrailingWagonRuntime::StopFollowingHitchedTeam': { port: 'stopFollowingHitchedTeam', mod: 'horseCart.js' },
  'TrailingWagonRuntime::TryGetLiveFollowingWagonPose': { port: 'tryGetLiveFollowingWagonPose', mod: 'horseCart.js' },
  'TrailingWagonRuntime::IsDirectHitchedTeamMount': { port: 'isDirectHitchedTeamMount', mod: 'horseCart.js' },
  'TrailingWagonRuntime::ResolveHorseActivation': { port: 'resolveHorseActivation', mod: 'horseCart.js' },
  'TrailingWagonRuntime::IsHorseCommandMode': { port: 'isHorseCommandMode', mod: 'horseCart.js' },
  'TrailingWagonRuntime::IsHorseNamingMode': { port: 'isHorseNamingMode', mod: 'horseCart.js' },
  'TrailingWagonRuntime::HorseTravelsWithFastTravel': { port: 'horseTravelsWithFastTravel', mod: 'horseCart.js' },
  'TrailingWagonRuntime::ShouldReconcileAfterTravelOptions': { port: 'shouldReconcileAfterTravelOptions', mod: 'horseCart.js' },
  'TrailingWagonRuntime::UpdateTravelOptionsCompatibility': { port: 'updateTravelOptionsCompatibility', mod: 'horseCart.js' },
  'TrailingWagonRuntime::TryQueryTravelOptionsActive': { port: 'updateTravelOptionsCompatibility', mod: 'horseCart.js' },
  'TrailingWagonRuntime::ReceiveTravelOptionsActive': { port: 'updateTravelOptionsCompatibility', mod: 'horseCart.js' },
  'TrailingWagonRuntime::ResolveFastTravelDepartureModes': { port: 'resolveFastTravelDepartureModes', mod: 'horseCart.js' },
  'TrailingWagonRuntime::HitchDeployedWagon': { port: 'hitchDeployedWagon', mod: 'horseCart.js' },
  'TrailingWagonRuntime::NewSaveData': { port: 'newSaveData', mod: 'horseCart.js' },
  'TrailingWagonRuntime::GetSaveData': { port: 'getSaveData', mod: 'horseCart.js' },
  'TrailingWagonRuntime::RestoreSaveData': { port: 'restoreSaveData', mod: 'horseCart.js' },
  'TrailingWagonRuntime::NormalizeSaveData': { port: 'normalizeSaveData', mod: 'horseCart.js' },
  'TrailingWagonRuntime::NormalizeHorseName': { port: 'normalizeHorseName', mod: 'horseCart.js' },
  'TrailingWagonRuntime::ResolveHorseNameInput': { port: 'resolveHorseNameInput', mod: 'horseCart.js' },
  'TrailingWagonRuntime::ReconcileHorseNameOwnership': { port: 'reconcileHorseNameOwnership', mod: 'horseCart.js' },
  'TrailingWagonRuntime::NormalizeHeading': { port: 'normalizeHeading', mod: 'horseCartLaw.js' },
  'TrailingWagonRuntime::ResetWagonState': { port: 'resetWagonState', mod: 'horseCart.js' },
  'TrailingWagonRuntime::SubscribeEvents': { port: null, why: 'no twin here: DFU\'s event bus (PlayerEnterExit / SaveLoadManager / StartGameBehaviour events); the hosts call the runtime\'s handlers directly (worldModes enter/exit, world.js save/load/new game/fast travel)' },
  'TrailingWagonRuntime::UnsubscribeEvents': { port: null, why: 'no twin here: DFU\'s event bus (PlayerEnterExit / SaveLoadManager / StartGameBehaviour events); the hosts call the runtime\'s handlers directly (worldModes enter/exit, world.js save/load/new game/fast travel)' },
  'TrailingWagonRuntime::HandleStartLoad': { port: 'handleStartLoad', mod: 'horseCart.js' },
  'TrailingWagonRuntime::HandleNewGame': { port: 'handleNewGame', mod: 'horseCart.js' },
  'TrailingWagonRuntime::HandlePreTransition': { port: 'handlePreTransition', mod: 'horseCart.js' },
  'TrailingWagonRuntime::HandleSuccessfulInteriorTransition': { port: 'handleSuccessfulInteriorTransition', mod: 'horseCart.js' },
  'TrailingWagonRuntime::HandleFailedTransition': { port: 'handleFailedTransition', mod: 'horseCart.js' },
  'TrailingWagonRuntime::HandleExteriorTransition': { port: 'handleExteriorTransition', mod: 'horseCart.js' },
  'TrailingWagonRuntime::HandlePreFastTravel': { port: 'handlePreFastTravel', mod: 'horseCart.js' },
  'TrailingWagonRuntime::HandlePostFastTravel': { port: 'handlePostFastTravel', mod: 'horseCart.js' },
  'TrailingWagonRuntime::ConvertFollowingTransportToWaitAtDeparture': { port: 'convertFollowingTransportToWaitAtDeparture', mod: 'horseCart.js' },
  'TrailingWagonRuntime::EnsureCustomWindowsRegistered': { port: null, why: 'no twin here: UIWindowFactory registration; the port\'s windows read the runtime through hooks (inventorySession openState / planWagonToggle, mountRig open)' },
  'TrailingWagonRuntime::CaptureHorseBehindPlayerPose': { port: 'captureHorseBehindPlayerPose', mod: 'horseCart.js' },
  'TrailingWagonRuntime::TryGetWagonScenePositionForEntrance': { port: 'tryGetWagonScenePositionForEntrance', mod: 'horseCart.js' },
  'TrailingWagonRuntime::SetInteriorAccessFromTransition': { port: 'setInteriorAccessFromTransition', mod: 'horseCart.js' },
  'TrailingWagonRuntime::ClearInteriorAccess': { port: 'clearInteriorAccess', mod: 'horseCart.js' },
  'TrailingWagonRuntime::ClearPendingInteriorState': { port: 'clearPendingInteriorState', mod: 'horseCart.js' },
  'TrailingWagonRuntime::ResolveInteriorEntryMode': { port: 'resolveInteriorEntryMode', mod: 'horseCart.js' },
  'TrailingWagonRuntime::IsCartInteriorDeployment': { port: 'isCartInteriorDeployment', mod: 'horseCart.js' },
  'TrailingWagonRuntime::ShouldDeployIndependentHorseForInterior': { port: 'shouldDeployIndependentHorseForInterior', mod: 'horseCart.js' },
  'TrailingWagonRuntime::ValidateInteriorAccessContext': { port: 'validateInteriorAccessContext', mod: 'horseCart.js' },
  'TrailingWagonRuntime::CanAccessWagonStorage': { port: 'canAccessWagonStorage', mod: 'horseCart.js' },
  'TrailingWagonRuntime::CanAccessWagonInventory': { port: 'canAccessWagonInventory', mod: 'horseCart.js' },
  'TrailingWagonRuntime::CanAccessWagonInventoryCore': { port: 'canAccessWagonInventoryCore', mod: 'horseCart.js' },
  'TrailingWagonRuntime::CanAccessWagonFromDungeonExit': { port: 'canAccessWagonFromDungeonExit', mod: 'horseCart.js' },
  'TrailingWagonRuntime::CanAccessWagonFromDungeonExitCore': { port: 'canAccessWagonFromDungeonExitCore', mod: 'horseCart.js' },
  'TrailingWagonRuntime::ConsumeWagonSelectionRequest': { port: 'consumeWagonSelectionRequest', mod: 'horseCart.js' },
  'TrailingWagonRuntime::IsWagonAtPlayerMapPixel': { port: 'isWagonAtPlayerMapPixel', mod: 'horseCart.js' },
  'TrailingWagonRuntime::ClearAllTransientState': { port: 'clearAllTransientState', mod: 'horseCart.js' },
  'TrailingWagonRuntime::ClearMovingPresentation': { port: 'clearMovingPresentation', mod: 'horseCart.js' },
  'TrailingWagonRuntime::DestroyDeployedWagonPresentation': { port: 'destroyDeployedWagonPresentation', mod: 'horseCart.js' },
  'TrailingWagonRuntime::DestroyAllStationaryPresentations': { port: 'destroyAllStationaryPresentations', mod: 'horseCart.js' },
  'TrailingWagonRuntime::DestroyStationaryHorsePresentation': { port: 'destroyStationaryHorsePresentation', mod: 'horseCart.js' },
  'TrailingWagonRuntime::ReleaseCargoVisualResources': { port: null, why: 'no twin here: Unity object lifetimes (Destroy on the generated meshes, the source mesh, the cargo roots); the pool\'s GPU meshes live for the session as every host mesh does' },
  'TrailingWagonRuntime::DestroyGeneratedVisualMeshes': { port: null, why: 'no twin here: Unity object lifetimes (Destroy on the generated meshes, the source mesh, the cargo roots); the pool\'s GPU meshes live for the session as every host mesh does' },
  'TrailingWagonRuntime::DestroyWagonSourceMesh': { port: null, why: 'no twin here: Unity object lifetimes (Destroy on the generated meshes, the source mesh, the cargo roots); the pool\'s GPU meshes live for the session as every host mesh does' },
  'TrailingWagonRuntime::OnDestroy': { port: null, why: 'no twin here: Unity object lifetimes (Destroy on the generated meshes, the source mesh, the cargo roots); the pool\'s GPU meshes live for the session as every host mesh does' },
  // ── TrailingWagonInventoryWindow (8)
  'TrailingWagonInventoryWindow::SetupActionButtons': { port: null, why: 'no twin here: DFU\'s action-button panel; the port\'s inventory window is ui/nativeInventory.js\'s own, with one wagon button whose click is planWagonToggle' },
  'TrailingWagonInventoryWindow::OnPush': { port: 'openState', mod: 'inventorySession.js' },
  'TrailingWagonInventoryWindow::Update': { port: 'openState', mod: 'inventorySession.js' },
  'TrailingWagonInventoryWindow::OnPop': { port: null, why: 'no twin here: the window\'s pending flags are derived at each open (inventorySession openState) rather than held, so there is nothing to clear on pop' },
  'TrailingWagonInventoryWindow::ApplyOpeningAccess': { port: 'openState', mod: 'inventorySession.js' },
  'TrailingWagonInventoryWindow::WagonButton_OnMouseClick': { port: 'planWagonToggle', mod: 'inventorySession.js' },
  'TrailingWagonInventoryWindow::SetWagonSelection': { port: '_showWagon', mod: 'nativeInventory.js' },
  'TrailingWagonInventoryWindow::DisableOriginalButton': { port: null, why: 'no twin here: DFU\'s Button / DaggerfallShortcut; the port\'s windows have one button each and no hotkey sequence to unbind' },
  // ── TrailingWagonTradeWindow (4)
  'TrailingWagonTradeWindow::SetupActionButtons': { port: null, why: 'no twin here: the port\'s trade window has no wagon toggle of its own yet (ui/nativeTrade.js: the action panel\'s wagon button is a consumed no-op awaiting its slice); when it lands it gates through canAccessWagonStorage(Trade) as the inventory\'s does' },
  'TrailingWagonTradeWindow::OnPush': { port: null, why: 'no twin here: the port\'s trade window has no wagon toggle of its own yet (ui/nativeTrade.js: the action panel\'s wagon button is a consumed no-op awaiting its slice); when it lands it gates through canAccessWagonStorage(Trade) as the inventory\'s does' },
  'TrailingWagonTradeWindow::WagonButton_OnMouseClick': { port: null, why: 'no twin here: the port\'s trade window has no wagon toggle of its own yet (ui/nativeTrade.js: the action panel\'s wagon button is a consumed no-op awaiting its slice); when it lands it gates through canAccessWagonStorage(Trade) as the inventory\'s does' },
  'TrailingWagonTradeWindow::DisableOriginalButton': { port: null, why: 'no twin here: the port\'s trade window has no wagon toggle of its own yet (ui/nativeTrade.js: the action panel\'s wagon button is a consumed no-op awaiting its slice); when it lands it gates through canAccessWagonStorage(Trade) as the inventory\'s does' },
  // ── TrailingWagonTransportWindow (11)
  'TrailingWagonTransportWindow::Setup': { port: 'open', mod: 'mountRig.js' },
  'TrailingWagonTransportWindow::CreatePhysicalButton': { port: 'open', mod: 'mountRig.js' },
  'TrailingWagonTransportWindow::DisableOriginalButton': { port: null, why: 'no twin here: DFU\'s Button / DaggerfallShortcut; the port\'s windows have one button each and no hotkey sequence to unbind' },
  'TrailingWagonTransportWindow::RuntimeCanMountHorse': { port: 'canMountHorseFromTransportWindow', mod: 'horseCart.js' },
  'TrailingWagonTransportWindow::RuntimeCanUseCart': { port: 'canUseCartFromTransportWindow', mod: 'horseCart.js' },
  'TrailingWagonTransportWindow::HorseButton_OnMouseClick': { port: 'open', mod: 'mountRig.js' },
  'TrailingWagonTransportWindow::HorseButton_OnKeyboardEvent': { port: 'open', mod: 'mountRig.js' },
  'TrailingWagonTransportWindow::ActivateHorse': { port: 'handleHorseTransportButton', mod: 'horseCart.js' },
  'TrailingWagonTransportWindow::CartButton_OnMouseClick': { port: 'open', mod: 'mountRig.js' },
  'TrailingWagonTransportWindow::CartButton_OnKeyboardEvent': { port: 'open', mod: 'mountRig.js' },
  'TrailingWagonTransportWindow::ActivateCart': { port: 'handleCartTransportButton', mod: 'horseCart.js' },
  // ── Wagon41214VisualBuilder (13)
  'Wagon41214VisualBuilder::TryBuild': { port: 'buildWagonParts', mod: 'wagon41214.js' },
  'Wagon41214VisualBuilder::CalculateWheelRadius': { port: 'buildWagonParts', mod: 'wagon41214.js' },
  'Wagon41214VisualBuilder::ReadTriangles': { port: 'readTriangles', mod: 'wagon41214.js' },
  'Wagon41214VisualBuilder::ValidateVertexIndex': { port: 'readTriangles', mod: 'wagon41214.js' },
  'Wagon41214VisualBuilder::BuildComponents': { port: 'buildComponents', mod: 'wagon41214.js' },
  'Wagon41214VisualBuilder::ConnectTriangle': { port: 'buildComponents', mod: 'wagon41214.js' },
  'Wagon41214VisualBuilder::CompareComponents': { port: 'buildComponents', mod: 'wagon41214.js' },
  'Wagon41214VisualBuilder::IdentifyVerifiedParts': { port: 'identifyVerifiedParts', mod: 'wagon41214.js' },
  'Wagon41214VisualBuilder::CreatePivot': { port: 'buildWagonParts', mod: 'wagon41214.js' },
  'Wagon41214VisualBuilder::CreateMeshObject': { port: 'ensureParts', mod: 'horseCartPool.js' },
  'Wagon41214VisualBuilder::BuildComponentMesh': { port: 'buildComponentModel', mod: 'wagon41214.js' },
  'Wagon41214VisualBuilder::RemapVertex': { port: 'buildComponentModel', mod: 'wagon41214.js' },
  'Wagon41214VisualBuilder::IsFinite': { port: 'isFinite3', mod: 'wagon41214.js' },
  // ── WagonCargoVisual (10)
  'WagonCargoVisual::get_PieceCount': { port: 'CARGO_DEFINITIONS', mod: 'wagon41214.js' },
  'WagonCargoVisual::TryCreate': { port: 'ensureCargo', mod: 'horseCartPool.js' },
  'WagonCargoVisual::ApplyFullness': { port: 'updateCargoFullness', mod: 'horseCart.js' },
  'WagonCargoVisual::ReleaseOwnedResources': { port: null, why: 'no twin here: the cargo pieces are not a hierarchy of tier roots toggled on and off - the pool draws the pieces the tier shows each frame (cargoPiecesShown, drawWagon) and their meshes live for the session' },
  'WagonCargoVisual::CalculateTier': { port: 'cargoTier', mod: 'horseCartLaw.js' },
  'WagonCargoVisual::ApplyTier': { port: 'cargoPiecesShown', mod: 'wagon41214.js' },
  'WagonCargoVisual::CreateIdentityChild': { port: null, why: 'no twin here: the cargo pieces are not a hierarchy of tier roots toggled on and off - the pool draws the pieces the tier shows each frame (cargoPiecesShown, drawWagon) and their meshes live for the session' },
  'WagonCargoVisual::CreateInactiveTierRoot': { port: null, why: 'no twin here: the cargo pieces are not a hierarchy of tier roots toggled on and off - the pool draws the pieces the tier shows each frame (cargoPiecesShown, drawWagon) and their meshes live for the session' },
  'WagonCargoVisual::SetActiveIfChanged': { port: 'cargoPiecesShown', mod: 'wagon41214.js' },
  'WagonCargoVisual::DestroyMeshes': { port: null, why: 'no twin here: the cargo pieces are not a hierarchy of tier roots toggled on and off - the pool draws the pieces the tier shows each frame (cargoPiecesShown, drawWagon) and their meshes live for the session' },
  // ── WagonSaveData (1)
  'WagonSaveData::Copy': { port: 'copySaveData', mod: 'horseCartLaw.js' },
  // ── ComponentData (2)
  'ComponentData::get_BoundsVolume': { port: 'buildComponents', mod: 'wagon41214.js' },
  'ComponentData::Include': { port: 'boundsOfComponent', mod: 'wagon41214.js' },
  // ── DisjointSet (2)
  'DisjointSet::Find': { port: 'DisjointSet', mod: 'wagon41214.js' },
  'DisjointSet::Union': { port: 'DisjointSet', mod: 'wagon41214.js' },
};

const PORTED = Object.entries(IL).filter(([, v]) => v.port);
const NOT = Object.entries(IL).filter(([, v]) => !v.port);
const PER_TYPE = { DeployedWagonActivator: 2, DeployedWagonFollowerCollisionFilter: 11, DeployedWagonVisual: 18, FollowingWagonActivator: 2, GroundSurfaceSelection: 1, HorseCartAccessDecision: 2, HorseCartTransportActionResult: 3, HorseCartCompatibilityApi: 9, HorseCartUiCompatibilityCoordinator: 11, HorseFollowController: 32, HorseFollowPath: 9, HorseNameTooltipController: 5, HorseTextureSet: 5, HorseWalkAnimationSet: 5, StationaryHorseActivator: 2, StationaryHorseBillboard: 9, StationaryHorseVisual: 16, TrailingWagonRuntime: 205, TrailingWagonInventoryWindow: 8, TrailingWagonTradeWindow: 4, TrailingWagonTransportWindow: 11, Wagon41214VisualBuilder: 13, WagonCargoVisual: 10, WagonSaveData: 1, ComponentData: 2, DisjointSet: 2 };

/** The dump's own inventory, by the same rule the header states. */
function authoredFromDump() {
  const txt = rd(IL_DUMP);
  const out = [];
  for (const m of txt.matchAll(/^---- (\S+)::(\S+) rva=/gm)) {
    const [, t, name] = m;
    if (name === '.ctor' || name === '.cctor') continue;
    if (name.startsWith('add_') || name.startsWith('remove_')) continue;
    if (/^<.*>b__/.test(name)) continue;
    if (t.startsWith('<') || t.includes('<>')) continue;
    if (['MoveNext', 'System.IDisposable.Dispose', 'System.Collections.IEnumerator.Reset', 'System.Collections.IEnumerator.get_Current', 'System.Collections.Generic.IEnumerator<System.Object>.get_Current'].includes(name)) continue;
    out.push(`${t}::${name}`);
  }
  return out;
}

test('HCC scope: the inventory is whole - 398 authored methods, every one a row, none missing, none invented', () => {
  assert.equal(Object.keys(IL).length, 398);
  const per = {};
  for (const k of Object.keys(IL)) { const [t] = k.split('::'); per[t] = (per[t] ?? 0) + 1; }
  assert.deepEqual(per, PER_TYPE);
  const dump = authoredFromDump();
  assert.equal(dump.length, 398, 'the dump holds the same 398 under the header\'s rule');
  const counts = new Map();
  for (const k of dump) counts.set(k, (counts.get(k) ?? 0) + 1);
  for (const k of Object.keys(IL)) {
    const base = k.replace(/#\d+$/, '');
    assert.ok(counts.has(base), `${k} is not a method the assembly has`);
  }
  for (const [k, n] of counts) {
    const rows = Object.keys(IL).filter((r) => r === k || r.startsWith(`${k}#`)).length;
    assert.equal(rows, n, `${k}: the dump has ${n} bodies and the table ${rows} rows`);
  }
});

test('HCC scope: every ported row names a symbol that exists in the module it names; every no-twin row says why', () => {
  const src = new Map(Object.entries(MOD).map(([m, p]) => [m, rd(p)]));
  for (const [k, v] of PORTED) {
    assert.ok(MOD[v.mod], `${k}: ${v.mod} is not a module this table knows`);
    assert.match(src.get(v.mod), new RegExp(`\\b${v.port.replace(/[$]/g, '\\$')}\\b`), `${k} -> ${v.port} is not in ${v.mod}`);
    assert.equal(v.why, undefined, `${k}: a ported row needs no excuse`);
  }
  for (const [k, v] of NOT) {
    assert.match(v.why ?? '', /^no twin here: /, `${k}: a row without a port says why, and it is never NOT DONE`);
    assert.ok(v.why.length > 60, `${k}: a reason, not a shrug`);
    assert.doesNotMatch(v.why, /NOT DONE|todo|later/i);
  }
  assert.equal(PORTED.length, 338); assert.equal(NOT.length, 60);
});

test('HCC scope: the no-twin rows fall into the families the port cannot have, and no runtime arithmetic is among them', () => {
  const families = ['collider holds no bodies', 'transform hierarchy', 'ModManager mod-message bus', 'Harmony', 'uploadTexture\'s cache', 'HUD TextLabel', 'Unity object lifetimes', 'event bus', 'trade window has no wagon toggle', 'pre-rc save files', 'DFU\'s Button', 'SaveDataInterface', 'drawn meshes never enter the collider', 'Unity layers', 'UIWindowFactory', 'action-button panel', 'derived at each open', 'hierarchy of tier roots'];
  for (const [k, v] of NOT) assert.ok(families.some((f) => v.why.includes(f)), `${k}: "${v.why.slice(0, 60)}" is not one of the known families`);
  // the arithmetic types are ported whole
  for (const t of ['GroundSurfaceSelection', 'HorseFollowPath', 'HorseFollowController', 'StationaryHorseBillboard', 'Wagon41214VisualBuilder', 'WagonSaveData', 'DisjointSet', 'ComponentData']) {
    assert.equal(NOT.filter(([k]) => k.startsWith(`${t}::`)).length, 0, `${t} has no unported method`);
  }
  assert.ok(NOT.filter(([k]) => k.startsWith('TrailingWagonRuntime::')).length <= 12, 'the runtime\'s few no-twins are the Unity/DFU plumbing ones');
});

test('HCC scope: the bible page states THIS table, and a 1:1 claim for this mod stands beside its check', () => {
  const page = rd('bible/06-Systems/Horse-Cart-And-Cargo.md');
  assert.match(page, /\*\*398 authored methods\*\*/);
  assert.match(page, /\*\*338 are ported\*\*/);
  assert.match(page, /\*\*60 have no twin\*\*/);
  assert.match(page, /test\/hcc_scope\.test\.js/);
  const notNames = new Set(NOT.map(([k]) => k.split('::')[0]));
  for (const t of ['DeployedWagonFollowerCollisionFilter', 'HorseCartUiCompatibilityCoordinator', 'TrailingWagonTradeWindow']) assert.ok(notNames.has(t) && page.includes(t), `the page names ${t} among the no-twins`);
  for (const f of ['bible/06-Systems/Horse-Cart-And-Cargo.md', 'bible/01-Overview/Mod-Registry.md', 'vendor/horse-cart-and-cargo/README.md']) {
    for (const line of rd(f).split('\n')) {
      if (!/1:1/.test(line) || !/horse cart|hcc/i.test(line)) continue;
      assert.match(line, /hcc_scope|338|no twin|IL|checkable|read off|scope/i, `${f}: a 1:1 claim for this mod carries its check - "${line.trim().slice(0, 120)}"`);
    }
  }
});
