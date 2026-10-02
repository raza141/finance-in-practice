"use client";

import { AdaptiveDpr, PerformanceMonitor } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { MathUtils, type Group, type PlaneGeometry } from "three";

import { VolatilitySurfaceModel } from "./VolatilitySurfaceModel";

const CYAN = "#22d3ee";
const SEGMENTS = 34;
const SIZE = 4.0;
const HEIGHT_SCALE = 6;
const MAX_TILT = 0.22; // radians, applied around the resting pose

/** Normalised pointer position in [-1, 1], tracked across the whole window. */
function usePointer() {
  const pointer = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      pointer.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (event.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);
  return pointer;
}

function VolatilitySurface({ animate }: { animate: boolean }) {
  const group = useRef<Group>(null);
  const geometry = useRef<PlaneGeometry>(null);
  const model = useMemo(() => new VolatilitySurfaceModel(), []);
  const pointer = usePointer();

  // Shape the surface once so a static (reduced-motion) render still shows it.
  useEffect(() => {
    const geo = geometry.current;
    if (!geo) return;
    model.fill(geo.attributes.position.array as Float32Array, SEGMENTS, 0, HEIGHT_SCALE);
    geo.attributes.position.needsUpdate = true;
  }, [model]);

  useFrame((state, delta) => {
    const geo = geometry.current;
    const g = group.current;
    if (!geo || !g) return;

    if (animate) {
      model.fill(
        geo.attributes.position.array as Float32Array,
        SEGMENTS,
        state.clock.elapsedTime,
        HEIGHT_SCALE,
      );
      geo.attributes.position.needsUpdate = true;
    }

    // Ease towards a pose driven by the cursor: tilt on X, yaw and pan on Y.
    const ease = 1 - Math.exp(-delta * 3);
    const { x, y } = pointer.current;
    g.rotation.x = MathUtils.lerp(g.rotation.x, -1.02 + y * MAX_TILT * 0.6, ease);
    g.rotation.z = MathUtils.lerp(g.rotation.z, -0.62 + x * MAX_TILT, ease);
    g.position.x = MathUtils.lerp(g.position.x, x * 0.25, ease);
  });

  return (
    <group ref={group} rotation={[-1.02, 0, -0.62]} position={[0, -0.45, 0]}>
      <mesh>
        <planeGeometry ref={geometry} args={[SIZE, SIZE, SEGMENTS, SEGMENTS]} />
        <meshBasicMaterial color={CYAN} wireframe transparent opacity={0.55} />
      </mesh>
      {/* faint floor grid for depth */}
      <mesh position={[0, 0, -0.9]}>
        <planeGeometry args={[SIZE, SIZE, 12, 12]} />
        <meshBasicMaterial color={CYAN} wireframe transparent opacity={0.08} />
      </mesh>
    </group>
  );
}

/** Hero WebGL scene: an animated implied-volatility surface that follows the cursor. */
export default function Hero3D() {
  const [reducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [dpr, setDpr] = useState(1.5);

  return (
    <Canvas
      camera={{ position: [0, 0, 8.6], fov: 40 }}
      dpr={dpr}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      frameloop={reducedMotion ? "demand" : "always"}
      aria-hidden
    >
      <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(1.5)} />
      <AdaptiveDpr pixelated />
      <VolatilitySurface animate={!reducedMotion} />
    </Canvas>
  );
}
