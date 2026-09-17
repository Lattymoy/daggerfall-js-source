using UnityEngine;
using System.Collections.Generic;
using DaggerfallWorkshop;
using DaggerfallWorkshop.Game;
using DaggerfallWorkshop.Utility;
using DaggerfallWorkshop.Game.Items;
using DaggerfallWorkshop.Game.Utility.ModSupport;

namespace SpellcastStudios.BetterFootsteps
{
    public class BetterFootstepsComponentPlayer : BetterFootstepsComponent
    {
        PlayerMotor playerMotor;

        private bool disableFootsteps;
        private float lastTravelOptionsCheckTime;
        protected override void Start()
        {
            playerMotor = GetComponent<PlayerMotor>();

            base.Start();
        }

        protected override void Update()
        {
            //Check for travel options change
            if(Time.time > lastTravelOptionsCheckTime + 0.5f)
            {
                ModManager.Instance.SendModMessage("TravelOptions", "isTravelActive", null, (msg,data) =>
                {
                    disableFootsteps = (bool)data;
                });

                lastTravelOptionsCheckTime = Time.time;
            }

            base.Update();
        }

        private void TravelOptionsActiveCallback(string message, object data)
        {
            Debug.Log("TRAVEL ACTIVE " + (bool)data);
            disableFootsteps = (bool)data;
        }

        protected override bool FootstepsEnabled()
        {
            return !disableFootsteps;
        }

        protected override bool IsOnExteriorWater()
        {
            return playerMotor.OnExteriorWater == PlayerMotor.OnExteriorWaterMethod.Swimming || playerMotor.OnExteriorWater == PlayerMotor.OnExteriorWaterMethod.WaterWalking;
        }

        protected override bool IsOnExteriorPath()
        {
            return playerMotor.OnExteriorPath;
        }

        protected override bool IsOnStaticGeometry()
        {
            return playerMotor.OnExteriorStaticGeometry;
        }

        protected override bool IsRunning()
        {
            return playerMotor.IsRunning;
        }

        protected override bool IsLevitating()
        {
            return playerMotor.IsLevitating;
        }

        protected override bool IsMovingLessThanHalfSpeed()
        {
            return playerMotor.IsMovingLessThanHalfSpeed;
        }

        protected override bool IsGrounded()
        {
            return playerMotor.IsGrounded;
        }

        protected override bool IsSwimming()
        {
            return playerMotor.IsSwimming;
        }

        protected override bool IsStandingStill()
        {
            return playerMotor.IsStandingStill;
        }
    }
}