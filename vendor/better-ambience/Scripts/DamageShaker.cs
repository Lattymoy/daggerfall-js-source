using UnityEngine;
using DaggerfallWorkshop.Game.Entity;

namespace SpellcastStudios.CameraShake
{
    public class DamageShaker : MonoBehaviour
    {
        public float shakeAmountAdd = 0;
        public float shakeAmountMultiplier = 10;
        public float maxShake = 10;
        public float roughness = 10;

        public float fadeInTime = 0.3f;
        public float fadeOutTime = 0.5f;

        private PlayerEntity player;
        private CameraShaker shaker;

        public void SetPlayer(PlayerEntity player, CameraShaker shaker)
        {
            this.player = player;
            this.shaker = shaker;
        }

        void RemoveHealth(int amount)
        {
            if (player == null || shaker == null)
                return;

            float shakeAmount = shakeAmountAdd + (shakeAmountMultiplier * amount / player.MaxHealth);
            shakeAmount = Mathf.Clamp(shakeAmount, 0, maxShake);

            shaker.ShakeOnce(shakeAmount, roughness, fadeInTime, fadeOutTime);
        }
    }
}