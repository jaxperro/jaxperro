import * as THREE from 'three';
import { BOAT } from './config.js';
import { getWaterHeight } from './ocean.js';

function buildBoatMesh() {
  const group = new THREE.Group();

  const hullMat = new THREE.MeshStandardMaterial({ color: 0xf2ede2, flatShading: true });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xc0452b, flatShading: true });
  const cabinMat = new THREE.MeshStandardMaterial({ color: 0xd9b27c, flatShading: true });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x36505e, roughness: 0.2 });

  // Hull outline drawn in top view (+Y toward the bow), extruded up, then
  // rotated so the bow points along local +Z and the deck faces +Y.
  const outline = new THREE.Shape();
  outline.moveTo(0, 3.2);
  outline.quadraticCurveTo(1.15, 1.6, 1.05, -1.4);
  outline.lineTo(0.85, -2.5);
  outline.quadraticCurveTo(0, -2.85, -0.85, -2.5);
  outline.lineTo(-1.05, -1.4);
  outline.quadraticCurveTo(-1.15, 1.6, 0, 3.2);

  const hullGeo = new THREE.ExtrudeGeometry(outline, {
    depth: 0.9,
    steps: 1,
    bevelEnabled: true,
    bevelThickness: 0.28,
    bevelSize: 0.2,
    bevelSegments: 2,
  });
  hullGeo.rotateX(-Math.PI / 2);
  hullGeo.rotateY(Math.PI);
  const hull = new THREE.Mesh(hullGeo, hullMat);
  hull.position.y = -0.35;
  group.add(hull);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.85, 1.7), cabinMat);
  cabin.position.set(0, 0.95, -0.5);
  group.add(cabin);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 1.95), trimMat);
  roof.position.set(0, 1.43, -0.5);
  group.add(roof);

  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.45, 0.06), glassMat);
  windshield.position.set(0, 1.05, 0.38);
  group.add(windshield);

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.1, 6), trimMat);
  pole.position.set(0, 1.4, -2.2);
  group.add(pole);

  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.32), trimMat);
  flag.material = trimMat.clone();
  flag.material.side = THREE.DoubleSide;
  flag.position.set(0, 1.78, -2.5);
  flag.rotation.y = Math.PI / 2;
  group.add(flag);

  return group;
}

// Simple arcade boat: throttle accelerates along the heading, drag bleeds
// speed off, steering rate scales with speed. Vertical position and tilt come
// from sampling the same wave field the ocean shader displaces.
export function createBoat() {
  const group = buildBoatMesh();
  group.rotation.order = 'YXZ';

  const position = group.position;
  let heading = 0;
  let speed = 0;
  let smoothedPitch = 0;
  let smoothedRoll = 0;
  let smoothedHeight = 0;

  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();

  // Push the boat out of axis-aligned square colliders ({x, z, half}) along
  // the axis of least penetration, bleeding speed while in contact so the
  // hull grinds to a stop instead of bouncing.
  const BOAT_RADIUS = 1.8;
  function resolveCollisions(colliders) {
    for (const c of colliders) {
      const reach = c.half + BOAT_RADIUS;
      const dx = position.x - c.x;
      const dz = position.z - c.z;
      if (Math.abs(dx) >= reach || Math.abs(dz) >= reach) continue;
      const overlapX = reach - Math.abs(dx);
      const overlapZ = reach - Math.abs(dz);
      if (overlapX < overlapZ) {
        position.x += Math.sign(dx || 1) * overlapX;
      } else {
        position.z += Math.sign(dz || 1) * overlapZ;
      }
      speed *= 0.9;
    }
  }

  function update(dt, input, time, colliders = []) {
    const accel = input.throttle >= 0 ? BOAT.acceleration : BOAT.acceleration * 0.6;
    speed += input.throttle * accel * dt;
    speed -= speed * BOAT.drag * dt;
    speed = THREE.MathUtils.clamp(speed, -BOAT.maxReverseSpeed, BOAT.maxForwardSpeed);

    // Rudder authority grows with speed; reversing flips the steering sense.
    const speedFactor = THREE.MathUtils.clamp(Math.abs(speed) / BOAT.maxForwardSpeed, 0, 1);
    const turnAuthority = 0.35 + 0.65 * speedFactor;
    const reverseSign = speed < -0.3 ? -1 : 1;
    heading -= input.steer * BOAT.turnRate * turnAuthority * reverseSign * dt;

    forward.set(Math.sin(heading), 0, Math.cos(heading));
    right.set(-Math.cos(heading), 0, Math.sin(heading));
    position.x += forward.x * speed * dt;
    position.z += forward.z * speed * dt;
    resolveCollisions(colliders);

    // Buoyancy: sample the wave field at center, fore/aft, and port/starboard.
    const hCenter = getWaterHeight(position.x, position.z, time);
    const d = BOAT.pitchSampleDist;
    const hBow = getWaterHeight(position.x + forward.x * d, position.z + forward.z * d, time);
    const hStern = getWaterHeight(position.x - forward.x * d, position.z - forward.z * d, time);
    const r = BOAT.rollSampleDist;
    const hStarboard = getWaterHeight(position.x + right.x * r, position.z + right.z * r, time);
    const hPort = getWaterHeight(position.x - right.x * r, position.z - right.z * r, time);

    const targetPitch = (hStern - hBow) / (2 * d);
    const heel = input.steer * speedFactor * 0.12;
    const targetRoll = (hPort - hStarboard) / (2 * r) + heel;
    const damp = 1 - Math.exp(-5 * dt);
    smoothedHeight += (hCenter + BOAT.floatOffset - smoothedHeight) * damp;
    smoothedPitch += (targetPitch - smoothedPitch) * damp;
    smoothedRoll += (targetRoll - smoothedRoll) * damp;

    position.y = smoothedHeight;
    group.rotation.y = heading;
    group.rotation.x = smoothedPitch;
    group.rotation.z = smoothedRoll;
  }

  return {
    group,
    position,
    update,
    getForward: () => forward,
    getSpeed: () => speed,
  };
}
