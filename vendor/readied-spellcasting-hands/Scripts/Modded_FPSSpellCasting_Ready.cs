// Project:         Daggerfall Tools For Unity
// Copyright:       Copyright (C) 2009-2020 Daggerfall Workshop
// Web Site:        http://www.dfworkshop.net
// License:         MIT License (http://www.opensource.org/licenses/mit-license.php)
// Source Code:     https://github.com/Interkarma/daggerfall-unity
// Original Author: Gavin Clayton (interkarma@dfworkshop.net)
// Contributors:    
// 
// Notes:
//

using UnityEngine;
using System;
using System.Collections;
using System.IO;
using System.Collections.Generic;
using DaggerfallConnect;
using DaggerfallConnect.Utility;
using DaggerfallConnect.Arena2;
using DaggerfallWorkshop.Utility;
using DaggerfallWorkshop.Utility.AssetInjection;
using DaggerfallWorkshop.Game.MagicAndEffects;

namespace DaggerfallWorkshop.Game
{
    /// <summary>
    /// Renders first-person spellcasting animations for player.
    /// Spellcasting animations have different texture and layout requirements to weapons
    /// and are never mixed with weapons directly on screen at same time.
    /// Opted to create a new class to play these animations and separate from FPSWeapon.
    /// </summary>
    public class Modded_FPSSpellCasting_Ready : MonoBehaviour
    {
        #region Types

        //class instead of struct because of mod compiling weird behavior
        private class AnimationRecord
        {
            public Texture2D Texture;
            public DFSize Size;
        }

        #endregion

        #region Fields

        const int nativeScreenWidth = 300;
        const int nativeScreenHeight = 200;
        const int releaseFrame = 5;
        const float smallFrameAdjust = 0.134f;
        const float animSpeed = 0.04f;                              // Set slower than classic for now

        ElementTypes currentAnimType = ElementTypes.None;
        Dictionary<int, AnimationRecord> castAnims = new Dictionary<int, AnimationRecord>();
        AnimationRecord handRecord;
        int currentFrame = -1;

        Rect leftHandPosition;
        Rect rightHandPosition;
        Rect leftHandAnimRect;
        Rect rightHandAnimRect;
        float handScaleX;
        float handScaleY;
        float offsetWidth;
        float offsetHeight;

        #endregion

        #region Properties

        public bool IsPlayingAnim
        {
            get { return currentFrame >= 0; }
        }

        #endregion

        #region Unity

        void Start()
        {
            StartCoroutine(AnimateSpellCast());
        }

        void OnGUI()
        {
            // Offset spellcasting animation by large HUD height when both large HUD and undocked weapon offset enabled
            // Animation is forced to offset when using docked HUD else it would appear underneath HUD
            // This helps user avoid such misconfiguration or it might be interpreted as a bug
            // Same logic as in FPSWeapon
            offsetHeight = 0;
            if (DaggerfallUI.Instance.DaggerfallHUD != null &&
                DaggerfallUnity.Settings.LargeHUD &&
                (DaggerfallUnity.Settings.LargeHUDUndockedOffsetWeapon || DaggerfallUnity.Settings.LargeHUDDocked))
            {
                offsetHeight = (int)DaggerfallUI.Instance.DaggerfallHUD.LargeHUD.ScreenHeight;
            }

            GUI.depth = 1;

            // Must be ready
            if (!ReadyCheck() || GameManager.IsGamePaused)
                return;

            // Update drawing positions for this frame
            // Does nothing if no animation is playing
            if (!UpdateSpellCast())
                return;

            if (Event.current.type.Equals(EventType.Repaint))
            {
                // Draw spell cast texture behind other HUD elements
                GUI.DrawTextureWithTexCoords(leftHandPosition, handRecord.Texture, leftHandAnimRect);
                GUI.DrawTextureWithTexCoords(rightHandPosition, handRecord.Texture, rightHandAnimRect);
            }
        }

        #endregion

        #region Private Methods

        /// <summary>
        /// Get animations for current spellcast.
        /// This happens the first time a spell is cast and stored for re-casting.
        /// It's likely player will use a wide variety of spell types in normal play.
        /// </summary>
        void SetCurrentAnims(ElementTypes elementType)
        {
            // Attempt to get current anims
            AnimationRecord animationRecord;
            if (castAnims.TryGetValue((int)elementType, out animationRecord))
            {
                currentAnimType = elementType;
                handRecord = animationRecord;
                return;
            }

            // Load spellcast file
            string filename = WeaponBasics.GetMagicAnimFilename(elementType);
            string path = Path.Combine(DaggerfallUnity.Instance.Arena2Path, filename);
            CifRciFile cifFile = new CifRciFile();
            if (!cifFile.Load(path, FileUsage.UseMemory, true))
                throw new Exception(string.Format("Could not load spell anims file {0}", path));

            // Load CIF palette
            cifFile.Palette.Load(Path.Combine(DaggerfallUnity.Instance.Arena2Path, cifFile.PaletteName));

            // Load textures - spells have a single frame per record unlike weapons
            animationRecord = new AnimationRecord();

            int record = 0;
            Texture2D texture;
            if (!TextureReplacement.TryImportCifRci(filename, record, 0, false, out texture))
            {
                // Get Color32 array
                DFSize sz;
                Color32[] colors = cifFile.GetColor32(record, 0, 0, 0, out sz);

                // Create Texture2D
                texture = new Texture2D(sz.Width, sz.Height, TextureFormat.ARGB32, false);
                texture.SetPixels32(colors);
                texture.Apply(true);
            }

            // Set filter mode and store in frames array
            if (texture)
            {
                texture.filterMode = (FilterMode)DaggerfallUnity.Settings.MainFilterMode;
                animationRecord.Texture = texture;
                animationRecord.Size = cifFile.GetSize(record);
            }

            castAnims.Add((int)elementType, animationRecord);

            // Use as current anims
            currentAnimType = elementType;
            handRecord = animationRecord;
        }

        private bool UpdateSpellCast()
        {
            // Do nothing if cast frame < 0
            if (currentFrame < 0)
                return false;

            // Get frame dimensions
            int frameIndex = 0;
            int width = handRecord.Size.Width;
            int height = handRecord.Size.Height;

            // Get hand scale
            handScaleX = (float)Screen.width / (float)nativeScreenWidth;
            handScaleY = (float)Screen.height / (float)nativeScreenHeight;

            // Adjust scale to be slightly larger when not using point filtering
            // This reduces the effect of filter shrink at edge of display
            if (DaggerfallUnity.Instance.MaterialReader.MainFilterMode != FilterMode.Point)
            {
                handScaleX *= 1.01f;
                handScaleY *= 1.01f;
            }

            // Get source rect
            leftHandAnimRect = new Rect(0, 0, 1, 1);
            rightHandAnimRect = new Rect(1, 0, -1, 1);

            // Determine frame offset based on source animation
            offsetWidth = 0f;
            if (frameIndex == 0 || frameIndex == 5 ||                           // Frames 0 and 5 are always small frames
                currentAnimType == ElementTypes.Fire && frameIndex == 4)          // Fire frame 4 is also a small frame
            {
                offsetWidth = smallFrameAdjust;
            }

            // Source casting animations are designed to fit inside a fixed 320x200 display
            // This means they might be a little stretched on widescreen displays
            AlignLeftHand(width, height);
            AlignRightHand(width, height);

            return true;
        }

        private void AlignLeftHand(int width, int height)
        {
            leftHandPosition = new Rect(
                Screen.width * offsetWidth,
                Screen.height - height * handScaleY - offsetHeight,
                width * handScaleX,
                height * handScaleY);
        }

        private void AlignRightHand(int width, int height)
        {
            rightHandPosition = new Rect(
                Screen.width * (1f - offsetWidth) - width * handScaleX,
                Screen.height - height * handScaleY - offsetHeight,
                width * handScaleX,
                height * handScaleY);
        }

        //the mod magic comes in here
        IEnumerator AnimateSpellCast()
        {
            var pef = GameManager.Instance.PlayerEffectManager;
            var psc = GameManager.Instance.PlayerSpellCasting;
            while (true)
            {
                if (pef.HasReadySpell && pef.ReadySpell.Settings.TargetType != TargetTypes.CasterOnly && !psc.IsPlayingAnim)
                {
                    currentFrame = 0;
                    switch (pef.ReadySpell.Settings.ElementType)
                    {
                        case ElementTypes.Cold:
                            SetCurrentAnims(ElementTypes.Cold);
                            break;
                        case ElementTypes.Fire:
                            SetCurrentAnims(ElementTypes.Fire);
                            break;
                        case ElementTypes.Magic:
                            SetCurrentAnims(ElementTypes.Magic);
                            break;
                        case ElementTypes.Poison:
                            SetCurrentAnims(ElementTypes.Poison);
                            break;
                        case ElementTypes.Shock:
                            SetCurrentAnims(ElementTypes.Shock);
                            break;
                        case ElementTypes.None:
                            SetCurrentAnims(ElementTypes.None);
                            break;
                    }
                    //Debug.LogFormat("Playing spell type {0}", currentAnimType.ToString());
                }
                else
                {
                    currentFrame = -1;
                }

                yield return new WaitForSeconds(animSpeed);
            }
        }

        private bool ReadyCheck()
        {
            // Do nothing if DaggerfallUnity not ready
            if (!DaggerfallUnity.Instance.IsReady)
            {
                DaggerfallUnity.LogMessage("FPSSpellCasting: DaggerfallUnity component is not ready. Have you set your Arena2 path?");
                return false;
            }

            // Must have current spell texture anims
            if (handRecord == null)
                return false;

            return true;
        }

        #endregion
    }
}