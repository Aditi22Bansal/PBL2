"use client";
import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Float } from "@react-three/drei";
import * as THREE from "three";

// Deliberately low-poly / stylized, not photoreal: flat-shaded materials,
// simple box/cylinder/cone primitives. Phase 2 recolor: the room now leans
// on the site's own mint/teal + coral accents (the same family as
// docs/assets/banner.svg's window/roof accents) instead of Phase 1's
// all-violet palette - a small diorama this central to the page can't stay
// violet-dominant once violet is meant to be a rare tertiary accent.
const TEAL = "#0d9488";
const TEAL_DARK = "#115e59";
const TEAL_DEEPER = "#134e4a";
const LINEN = "#fff7ed";
const WARM = "#fb923c";
const WOOD = "#b45309";
const PLANT = "#34d399";
const PLANT_DARK = "#10b981";

function Bed({ position, sheet }: { position: [number, number, number]; sheet: string }) {
  return (
    <group position={position}>
      {/* frame */}
      <mesh position={[0, 0.18, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.9, 0.36, 1.1]} />
        <meshStandardMaterial color={TEAL_DEEPER} flatShading />
      </mesh>
      {/* mattress */}
      <mesh position={[0, 0.42, 0]} castShadow>
        <boxGeometry args={[1.8, 0.18, 1.0]} />
        <meshStandardMaterial color={sheet} flatShading />
      </mesh>
      {/* pillow */}
      <mesh position={[-0.72, 0.56, 0]} castShadow>
        <boxGeometry args={[0.34, 0.12, 0.7]} />
        <meshStandardMaterial color={LINEN} flatShading />
      </mesh>
      {/* headboard */}
      <mesh position={[-0.95, 0.55, 0]} castShadow>
        <boxGeometry args={[0.08, 0.7, 1.1]} />
        <meshStandardMaterial color={TEAL_DARK} flatShading />
      </mesh>
    </group>
  );
}

function Desk({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.9, 0.06, 0.55]} />
        <meshStandardMaterial color={WOOD} flatShading />
      </mesh>
      {[[-0.38, -0.22], [0.38, -0.22], [-0.38, 0.22], [0.38, 0.22]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.25, z]} castShadow>
          <boxGeometry args={[0.06, 0.5, 0.06]} />
          <meshStandardMaterial color={WOOD} flatShading />
        </mesh>
      ))}
      {/* small lamp - the one warm accent glow in an otherwise daylit room */}
      <mesh position={[0.3, 0.58, 0.15]} castShadow>
        <coneGeometry args={[0.09, 0.14, 12]} />
        <meshStandardMaterial color={WARM} emissive={WARM} emissiveIntensity={0.6} flatShading />
      </mesh>
      <mesh position={[0.3, 0.5, 0.15]}>
        <cylinderGeometry args={[0.015, 0.015, 0.16, 8]} />
        <meshStandardMaterial color={TEAL_DEEPER} flatShading />
      </mesh>
    </group>
  );
}

function Wardrobe({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.75, 1.5, 0.5]} />
        <meshStandardMaterial color={TEAL_DARK} flatShading />
      </mesh>
      <mesh position={[0.02, 0.75, 0.26]}>
        <boxGeometry args={[0.02, 1.4, 0.02]} />
        <meshStandardMaterial color={TEAL_DEEPER} flatShading />
      </mesh>
    </group>
  );
}

function Plant({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.15, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.12, 0.3, 8]} />
        <meshStandardMaterial color={WOOD} flatShading />
      </mesh>
      <mesh position={[-0.06, 0.42, 0.03]} castShadow>
        <sphereGeometry args={[0.16, 8, 6]} />
        <meshStandardMaterial color={PLANT} flatShading />
      </mesh>
      <mesh position={[0.08, 0.52, -0.04]} castShadow>
        <sphereGeometry args={[0.19, 8, 6]} />
        <meshStandardMaterial color={PLANT_DARK} flatShading />
      </mesh>
      <mesh position={[0.02, 0.35, -0.08]} castShadow>
        <sphereGeometry args={[0.13, 8, 6]} />
        <meshStandardMaterial color={PLANT} flatShading />
      </mesh>
    </group>
  );
}

function Window({ position }: { position: [number, number, number] }) {
  return (
    <group position={position} rotation={[0, Math.PI / 2, 0]}>
      <mesh>
        <boxGeometry args={[1.1, 1.1, 0.06]} />
        <meshStandardMaterial color={WOOD} flatShading />
      </mesh>
      <mesh position={[0, 0, 0.035]}>
        <boxGeometry args={[0.95, 0.95, 0.02]} />
        <meshStandardMaterial color={WARM} emissive={WARM} emissiveIntensity={0.3} flatShading />
      </mesh>
      {/* Was intensity 8 to be the room's one real light source against a
          dark backdrop; now a secondary warm accent glow layered on top of
          real daylight (ambient + directional below), so it's toned down
          rather than blown out against the lighter overall scene. */}
      <pointLight position={[0, 0, 0.3]} intensity={3.5} color={WARM} distance={4} decay={2} />
    </group>
  );
}

function RoomFloor() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.02, 0]}>
        <boxGeometry args={[4.6, 3.4, 0.04]} />
        <meshStandardMaterial color="#ded5c3" flatShading />
      </mesh>
      {/* back walls, low, cutaway-style */}
      <mesh position={[-2.28, 0.55, 0]} receiveShadow>
        <boxGeometry args={[0.05, 1.1, 3.4]} />
        <meshStandardMaterial color="#eee7d9" flatShading />
      </mesh>
      <mesh position={[0, 0.55, -1.68]} receiveShadow>
        <boxGeometry args={[4.6, 1.1, 0.05]} />
        <meshStandardMaterial color="#e6ddcb" flatShading />
      </mesh>
    </group>
  );
}

function RoomRig() {
  const group = useRef<THREE.Group>(null);
  const baseYaw = Math.PI / 5;
  const target = useRef({ x: 0, y: 0 });

  useFrame((state, delta) => {
    if (!group.current) return;
    // The isometric "looking down into the room" angle comes entirely from
    // the camera's own elevated position (see CameraRig/Canvas below) - this
    // group only handles slow Y auto-rotation plus a SMALL mouse-parallax
    // nudge, so the two angles never compound into something over-tilted.
    const px = state.pointer.x * 0.15;
    const py = state.pointer.y * 0.08;
    target.current.x = THREE.MathUtils.lerp(target.current.x, px, 0.04);
    target.current.y = THREE.MathUtils.lerp(target.current.y, py, 0.04);

    group.current.rotation.y = baseYaw + state.clock.elapsedTime * 0.06 + target.current.x;
    group.current.rotation.x = target.current.y * 0.3;
  });

  return (
    <group ref={group} rotation={[0, baseYaw, 0]} position={[0, -0.35, 0]}>
      <RoomFloor />
      <Bed position={[-1.15, 0, -0.7]} sheet={TEAL} />
      <Bed position={[0.75, 0, 0.85]} sheet={WARM} />
      <Desk position={[-1.5, 0, 1.0]} />
      <Wardrobe position={[1.45, 0, -0.95]} />
      <Plant position={[1.55, 0, 0.6]} />
      <Window position={[-2.3, 0.55, -0.55]} />
    </group>
  );
}

// R3F's default camera does NOT auto-aim at the origin just because a
// `position` is given - without an explicit lookAt it keeps its default
// forward-facing rotation, which (for a diagonal position like ours) points
// it almost past the room entirely. This was the actual cause of the
// broken/close-up-looking first render - not a scale or geometry problem.
function CameraRig() {
  const { camera } = useThree();
  useEffect(() => {
    camera.lookAt(0, 0.15, 0);
  }, [camera]);
  return null;
}

export default function HeroScene3D() {
  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{ position: [6.3, 4.0, 6.3], fov: 30 }}
      gl={{ antialias: true, alpha: true }}
    >
      <CameraRig />
      {/* Phase 1 tuned this for a near-black page: a dim ambient (0.55) let
          the small warm lamp read as the scene's one real light source.
          Against the new light page, that same dim ambient made the whole
          diorama look like a dark cutout - raised so the room's own warm
          daylight walls/floor/wood actually read, with the window lamp now
          a secondary accent (see its toned-down intensity above) instead
          of the only thing doing work. */}
      <ambientLight intensity={0.85} />
      <directionalLight
        position={[3, 5, 2]}
        intensity={1.35}
        color="#fff7ed"
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <Float speed={1.2} floatIntensity={0.15} rotationIntensity={0}>
        <RoomRig />
      </Float>
      {/* Contact shadow: was a dark indigo blob (#1e1b4b) that only ever
          had to disappear into an already-dark page. On the new light
          background a shadow that saturated needs to be a warm neutral
          and notably softer, or it reads as a stain rather than grounding
          the object. */}
      <ContactShadows position={[0, -0.62, 0]} opacity={0.28} scale={6} blur={2.8} far={2} color="#57534e" />
      <Environment preset="apartment" environmentIntensity={0.55} />
    </Canvas>
  );
}
