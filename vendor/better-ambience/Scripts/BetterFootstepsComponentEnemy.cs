
using UnityEngine;
using System.Collections.Generic;
using DaggerfallWorkshop;
using DaggerfallWorkshop.Game;
using DaggerfallWorkshop.Utility;
using DaggerfallWorkshop.Game.Items;

namespace SpellcastStudios.BetterFootsteps
{
    public class BetterFootstepsComponentEnemy : BetterFootstepsComponent
    {
        private EnemyMotor enemyMotor;
        private CharacterController controller;
        private DaggerfallMobileUnit mobile;

        protected override void Start()
        {
            enemyMotor = GetComponent<EnemyMotor>();
            controller = GetComponent<CharacterController>();
            mobile = GetComponent<DaggerfallMobileUnit>();

            base.Start();
        }

        //NPC's will not make path sounds
        protected override bool IsOnExteriorPath()
        {
            return false;
        }

        protected override bool IsRunning()
        {
            return false;
        }

        protected override bool IsGrounded()
        {
            return controller.isGrounded;
        }

        protected override bool IsLevitating()
        {
            return enemyMotor.IsLevitating;
        }

        protected override bool IsOnStaticGeometry()
        {
            float rayDistance = 1;

            RaycastHit hit;
            if (GameManager.Instance.PlayerEnterExit.IsPlayerInside || !Physics.Raycast(transform.position, Vector3.down, out hit, rayDistance * 2))
            {
                return false;
            }
            else
            {
                return hit.collider.tag.Equals("StaticGeometry");
            }
        }

        protected override bool IsSwimming()
        {
            return mobile.Summary.Enemy.Behaviour == MobileBehaviour.Aquatic;
        }
    }
}
