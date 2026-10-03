"use client";

import { AdaptiveDpr } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import { AdditiveBlending, BufferGeometry, Color, Float32BufferAttribute, type Group } from "three";

const SIZE = 48; // grid extent in world units
const CELL = 1.5;
const NODES = 140;
const CANVAS_BG = new Color("#0b1120");

/** Line segments for a square grid on the XZ plane, centred on the origin. */
function gridGeometry(): BufferGeometry {
  const half = SIZE / 2;
  const positions: number[] = [];
  for (let v = -half; v <= half + 1e-6; v += CELL) {
    positions.push(-half, 0, v, half, 0, v); // along X
    positions.push(v, 0, -half, v, 0, half); // along Z
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  return geometry;
}

/** Sparse "quotes" hovering over grid intersections. */
function nodeGeometry(): BufferGeometry {
  const half = SIZE / 2;
  const positions: number[] = [];
  for (let i = 0; i < NODES; i++) {
    const x = Math.round((Math.random() * SIZE - half) / CELL) * CELL;
    const z = Math.round((Math.random() * SIZE - half) / CELL) * CELL;
    positions.push(x, 0.02 + Math.random() * 0.9, z);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  return geometry;
}

function Grid({ animate }: { animate: boolean }) {
  const group = useRef<Group>(null);
  const lines = useMemo(() => gridGeometry(), []);
  const nodes = useMemo(() => nodeGeometry(), []);

  useFrame(({ clock }) => {
    if (!animate || !group.current) return;
    const t = clock.elapsedTime;
    // Drift toward the camera; wrapping by one cell keeps the motion seamless.
    group.current.position.z = (t * 0.22) % CELL;
    group.current.position.x = Math.sin(t * 0.05) * 0.6;
    group.current.rotation.y = Math.sin(t * 0.03) * 0.04;
  });

  return (
    <group ref={group}>
      <lineSegments geometry={lines}>
        <lineBasicMaterial color="#22d3ee" transparent opacity={0.16} depthWrite={false} />
      </lineSegments>
      <points geometry={nodes}>
        <pointsMaterial color="#67e8f9" size={0.07} sizeAttenuation transparent opacity={0.55} depthWrite={false} blending={AdditiveBlending} />
      </points>
    </group>
  );
}

/** Dark perspective grid drifting slowly toward the viewer, fading into fog. */
export default function DriftingGrid({ active = true }: { active?: boolean }) {
  const [reducedMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  return (
    <Canvas
      camera={{ position: [0, 2.2, 7], fov: 55, near: 0.1, far: 60 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      frameloop={active && !reducedMotion ? "always" : "demand"}
      onCreated={({ camera }) => camera.lookAt(0, 0, -6)}
    >
      <fog attach="fog" args={[CANVAS_BG, 4, 26]} />
      <AdaptiveDpr pixelated={false} />
      <Grid animate={!reducedMotion} />
    </Canvas>
  );
}
