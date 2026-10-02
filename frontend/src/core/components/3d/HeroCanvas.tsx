"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Group } from "three";

const CYAN = "#22d3ee";

/** Points on an n x n x n lattice centred on the origin: the "matrix". */
function latticePositions(n: number, spacing: number): Float32Array {
  const positions = new Float32Array(n * n * n * 3);
  const offset = ((n - 1) * spacing) / 2;
  let i = 0;
  for (let x = 0; x < n; x++)
    for (let y = 0; y < n; y++)
      for (let z = 0; z < n; z++) {
        positions[i++] = x * spacing - offset;
        positions[i++] = y * spacing - offset;
        positions[i++] = z * spacing - offset;
      }
  return positions;
}

function WireframeMatrix({ speed }: { speed: number }) {
  const outer = useRef<Group>(null);
  const inner = useRef<Group>(null);
  const lattice = useMemo(() => latticePositions(7, 0.62), []);

  useFrame((state, delta) => {
    if (outer.current) {
      outer.current.rotation.y += delta * 0.18 * speed;
      outer.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.25) * 0.18;
    }
    if (inner.current) {
      inner.current.rotation.y -= delta * 0.32 * speed;
      inner.current.rotation.z += delta * 0.12 * speed;
    }
  });

  return (
    <group>
      <group ref={outer}>
        <mesh>
          <icosahedronGeometry args={[2.35, 1]} />
          <meshBasicMaterial color={CYAN} wireframe transparent opacity={0.55} />
        </mesh>
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[lattice, 3]} />
          </bufferGeometry>
          <pointsMaterial color={CYAN} size={0.035} transparent opacity={0.45} sizeAttenuation />
        </points>
      </group>
      <group ref={inner}>
        <mesh>
          <octahedronGeometry args={[1.05, 0]} />
          <meshBasicMaterial color={CYAN} wireframe transparent opacity={0.9} />
        </mesh>
        <mesh scale={1.6}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color={CYAN} wireframe transparent opacity={0.22} />
        </mesh>
      </group>
    </group>
  );
}

export default function HeroCanvas() {
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <Canvas
      camera={{ position: [0, 0, 6.2], fov: 45 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      frameloop={reducedMotion ? "demand" : "always"}
      aria-hidden
    >
      <WireframeMatrix speed={reducedMotion ? 0 : 1} />
    </Canvas>
  );
}
