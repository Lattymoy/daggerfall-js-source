using UnityEngine;
using DaggerfallWorkshop.Game.Utility.ModSupport;
using DaggerfallWorkshop.Game;
using DaggerfallWorkshop.Game.Utility.ModSupport.ModSettings;
using DaggerfallWorkshop;
using DaggerfallWorkshop.Game.Entity;
using DaggerfallWorkshop.Game.Utility;

namespace SpellcastStudios.BetterFootsteps
{
    public class BetterFootstepsMod : MonoBehaviour
    {
        private static Mod mod;

        private ModSettings settings;
        private BetterFootstepsComponent footstepsComponent;

        private float armorSoundVolume;
        private float footstepSoundVolume;
        private bool enableCustomFootsteps;

        [Invoke(StateManager.StateTypes.Start, 0)]
        public static void Init(InitParams initParams)
        {
            Debug.Log("Initializing Better Footsteps Mod");
            mod = initParams.Mod;

            var go = new GameObject("Better Footsteps Module");
            go.AddComponent<BetterFootstepsMod>();
        }

        private void Start()
        {
            //Heck hack
            if (!mod.GetSettings().GetValue<bool>("Better Footsteps", "enable"))
                return;

            DisableBuiltInFootsteps();

            if (footstepsComponent == null)
                footstepsComponent = GameManager.Instance.PlayerObject.AddComponent<BetterFootstepsComponentPlayer>();

            ApplyFootsteps(footstepsComponent);

            mod.IsReady = true;

            LoadSettings(mod.GetSettings());

            //GameManager.OnEncounter += UpdateEnemyFootsteps;
            //PlayerEnterExit.OnTransitionDungeonInterior += OnTransitionDungeonInterior;
        }

        private void OnTransitionDungeonInterior(PlayerEnterExit.TransitionEventArgs args)
        {
            UpdateEnemyFootsteps();
        }

        private void UpdateEnemyFootsteps()
        {
            foreach(var enemy in GameObject.FindObjectsOfType<EnemyMotor>())
            {
                if (enemy.GetComponent<BetterFootstepsComponentEnemy>() != null)
                    continue;

                var entity = enemy.GetComponent<DaggerfallEntityBehaviour>();

                if (!ShouldEnemyHaveFootsteps(entity))
                    continue;

                var footsteps = enemy.gameObject.AddComponent<BetterFootstepsComponentEnemy>();
                ApplyFootsteps(footsteps);
            }
        }

        private bool ShouldEnemyHaveFootsteps(DaggerfallEntityBehaviour entity)
        {
            return true;
        }

        private void LoadSettings(ModSettings settings)
        {
            enableCustomFootsteps = settings.GetValue<bool>("Better Footsteps", "enable");

            armorSoundVolume = settings.GetValue<float>("Better Footsteps", "armorVolume");
            footstepSoundVolume = settings.GetValue<float>("Better Footsteps", "footstepVolume");

            footstepsComponent.FootstepsArmor.SetVolume(0.4f * armorSoundVolume);
            footstepsComponent.FootstepSoundDungeon.SetVolume(0.3f * footstepSoundVolume);
            footstepsComponent.FootstepSoundBuilding.SetVolume(0.4f * footstepSoundVolume);
            footstepsComponent.FootstepSoundShallow.SetVolume(0.4f * footstepSoundVolume);
            footstepsComponent.FootstepSoundOutside.SetVolume(0.15f * footstepSoundVolume);
            footstepsComponent.FootstepSoundSubmerged.SetVolume(footstepSoundVolume);
            footstepsComponent.FootstepSoundSnow.SetVolume(footstepSoundVolume);
        }

        private void ApplyFootsteps(BetterFootstepsComponent footsteps)
        {
            footsteps.FootstepSoundBuilding.AddAudioClips(SoundUtility.TryImportAudioClips("sfx_footstep_wood", "wav", 4, false));
            footsteps.FootstepSoundBuilding.SetPitchRange(0.8f, 1.2f);

            footsteps.FootstepSoundDungeon.AddAudioClips(SoundUtility.TryImportAudioClips("sfx_footstep_stone", "wav", 4, false));
            footsteps.FootstepSoundDungeon.SetPitchRange(0.8f, 1.2f);

            footsteps.FootstepsArmor.AddAudioClips(SoundUtility.TryImportAudioClips("sfx_footstep_armor_light", "wav", 11, false));
            footsteps.FootstepsArmor.SetPitchRange(1f, 1.2f);

            footsteps.FootstepSoundOutside.AddAudioClips(SoundUtility.TryImportAudioClips("sfx_footstep_crunchy-grass", "wav", 4, false));
            footsteps.FootstepSoundOutside.SetPitchRange(0.8f, 1.2f);

            footsteps.FootstepSoundShallow.AddAudioClips(SoundUtility.TryImportAudioClips("sfx_footstep_water", "wav", 6, false));
            footsteps.FootstepSoundShallow.SetPitchRange(0.8f, 1.2f);

            footsteps.FootstepSoundSubmerged.AddSoundClip(SoundClips.SplashSmall);
            footsteps.FootstepSoundSubmerged.SetPitchRange(0.8f, 1.2f);

            footsteps.FootstepSoundSnow.AddSoundClip(SoundClips.PlayerFootstepSnow1);
            footsteps.FootstepSoundSnow.AddSoundClip(SoundClips.PlayerFootstepSnow2);
            footsteps.FootstepSoundSnow.SetPitchRange(0.8f, 1.2f);
        }

        private void DisableBuiltInFootsteps()
        {
            var oldFootsteps = GameManager.Instance.PlayerObject.GetComponent<PlayerFootsteps>();

            oldFootsteps.FootstepSoundBuilding1 = SoundClips.None;
            oldFootsteps.FootstepSoundBuilding2 = SoundClips.None;
            oldFootsteps.FootstepSoundDungeon1 = SoundClips.None;
            oldFootsteps.FootstepSoundDungeon1 = SoundClips.None;
            oldFootsteps.FootstepSoundOutside1 = SoundClips.None;
            oldFootsteps.FootstepSoundOutside1 = SoundClips.None;
            oldFootsteps.FootstepSoundShallow = SoundClips.None;
            oldFootsteps.FootstepSoundSnow1 = SoundClips.None;
            oldFootsteps.FootstepSoundSnow2 = SoundClips.None;
            oldFootsteps.FootstepSoundSubmerged = SoundClips.None;

        }

    }
}