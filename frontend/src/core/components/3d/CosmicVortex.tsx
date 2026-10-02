"use client";

import { AdaptiveDpr, PerformanceMonitor } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import { AdditiveBlending, BufferAttribute, BufferGeometry, MathUtils, type Group, type ShaderMaterial } from "three";

import type { CosmicState } from "./CosmicState";

const ARMS = 3;
const DISC_POINTS = 52000;
const STAR_POINTS = 1400;

const DISC_VERTEX = /* glsl */ `
  attribute float aRadius;
  attribute float aAngle;
  attribute float aHeight;
  attribute float aSeed;
  uniform float uTime;
  uniform float uSpin;
  uniform float uWarp;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float r = aRadius * (1.0 - uWarp * 0.35 / (0.6 + aRadius * 0.4));
    // Differential rotation: the core turns faster than the rim, which winds the arms.
    float a = aAngle + (uTime * 0.22 + uSpin) * (1.6 / (0.5 + r));
    vec3 p = vec3(cos(a) * r, aHeight * (0.25 + r * 0.12), sin(a) * r);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (2.0 + aSeed * 4.0 + uWarp * 2.0) * uPixelRatio * (9.0 / -mv.z);

    vec3 core = vec3(0.92, 0.97, 1.0);
    vec3 cyan = vec3(0.13, 0.83, 0.93);
    vec3 deep = vec3(0.10, 0.22, 0.55);
    vColor = mix(core, cyan, smoothstep(0.6, 1.8, r));
    vColor = mix(vColor, deep, smoothstep(1.8, 5.0, r));
    vAlpha = (0.45 + aSeed * 0.55) * (1.0 - smoothstep(3.8, 5.6, r)) * smoothstep(0.55, 0.9, r);
  }
`;

const STAR_VERTEX = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (1.0 + aSeed * 2.0) * uPixelRatio;
    vColor = vec3(0.95, 0.98, 1.0);
    vAlpha = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * (0.6 + aSeed * 1.8) + aSeed * 40.0));
  }
`;

const POINT_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float falloff = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vColor, falloff * falloff * vAlpha);
  }
`;

/** Box-Muller normal sample, used to scatter particles around each arm. */
function gaussian(): number {
  return Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
}

function buildDisc(): BufferGeometry {
  const radius = new Float32Array(DISC_POINTS);
  const angle = new Float32Array(DISC_POINTS);
  const height = new Float32Array(DISC_POINTS);
  const seed = new Float32Array(DISC_POINTS);
  for (let i = 0; i < DISC_POINTS; i++) {
    const r = 0.7 + Math.pow(Math.random(), 1.5) * 4.8;
    const arm = ((i % ARMS) / ARMS) * Math.PI * 2;
    radius[i] = r;
    angle[i] = arm + r * 1.55 + gaussian() * (0.16 + 0.05 * r);
    height[i] = gaussian() * 0.12;
    seed[i] = Math.random();
  }
  const geometry = new BufferGeometry();
  // Positions are computed in the shader; three only needs the vertex count.
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(DISC_POINTS * 3), 3));
  geometry.setAttribute("aRadius", new BufferAttribute(radius, 1));
  geometry.setAttribute("aAngle", new BufferAttribute(angle, 1));
  geometry.setAttribute("aHeight", new BufferAttribute(height, 1));
  geometry.setAttribute("aSeed", new BufferAttribute(seed, 1));
  geometry.boundingSphere = null;
  return geometry;
}

function buildStars(): BufferGeometry {
  const position = new Float32Array(STAR_POINTS * 3);
  const seed = new Float32Array(STAR_POINTS);
  for (let i = 0; i < STAR_POINTS; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 12 + Math.random() * 18;
    position.set([r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta)], i * 3);
    seed[i] = Math.random();
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(position, 3));
  geometry.setAttribute("aSeed", new BufferAttribute(seed, 1));
  return geometry;
}

function Vortex({ state, animate }: { state: CosmicState; animate: boolean }) {
  const disc = useRef<Group>(null);
  const stars = useRef<Group>(null);
  const discMaterial = useRef<ShaderMaterial>(null);
  const starMaterial = useRef<ShaderMaterial>(null);

  const discGeometry = useMemo(() => buildDisc(), []);
  const starGeometry = useMemo(() => buildStars(), []);
  const discUniforms = useMemo(
    () => ({ uTime: { value: 0 }, uSpin: { value: 0 }, uWarp: { value: 0 }, uPixelRatio: { value: 1 } }),
    [],
  );
  const starUniforms = useMemo(() => ({ uTime: { value: 0 }, uPixelRatio: { value: 1 } }), []);

  // Smoothed copies of the targets so scroll jumps never snap the camera.
  const current = useRef({ spin: state.spin, tilt: state.tilt, zoom: state.zoom });

  useFrame((frame, delta) => {
    const ease = 1 - Math.exp(-delta * 2.4);
    const c = current.current;
    c.spin = MathUtils.lerp(c.spin, state.spin, ease);
    c.tilt = MathUtils.lerp(c.tilt, state.tilt, ease);
    c.zoom = MathUtils.lerp(c.zoom, state.zoom, ease);

    const time = animate ? frame.clock.elapsedTime : 0;
    const pixelRatio = frame.gl.getPixelRatio();
    if (discMaterial.current) {
      const u = discMaterial.current.uniforms;
      u.uTime.value = time;
      u.uSpin.value = c.spin;
      u.uWarp.value = state.warp;
      u.uPixelRatio.value = pixelRatio;
    }
    if (starMaterial.current) {
      starMaterial.current.uniforms.uTime.value = time;
      starMaterial.current.uniforms.uPixelRatio.value = pixelRatio;
    }
    if (disc.current) disc.current.rotation.x = c.tilt;
    if (stars.current) stars.current.rotation.y = time * 0.01 + c.spin * 0.05;
    frame.camera.position.z = c.zoom;
  });

  return (
    <>
      {/* Lifted so the bright "eye" frames the copy from above, as in a portfolio hero. */}
      <group ref={disc} position={[0, 2.1, 0]} rotation={[state.tilt, 0, 0.18]}>
        <points geometry={discGeometry} frustumCulled={false}>
          <shaderMaterial
            ref={discMaterial}
            vertexShader={DISC_VERTEX}
            fragmentShader={POINT_FRAGMENT}
            uniforms={discUniforms}
            transparent
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </points>
      </group>
      <group ref={stars}>
        <points geometry={starGeometry}>
          <shaderMaterial
            ref={starMaterial}
            vertexShader={STAR_VERTEX}
            fragmentShader={POINT_FRAGMENT}
            uniforms={starUniforms}
            transparent
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </points>
      </group>
    </>
  );
}

/** Spiral-galaxy particle vortex. Camera and spin follow the shared CosmicState. */
export default function CosmicVortex({ state, active = true }: { state: CosmicState; active?: boolean }) {
  const [reducedMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [dpr, setDpr] = useState(1.5);

  return (
    <Canvas
      camera={{ position: [0, 0, state.zoom], fov: 45 }}
      dpr={dpr}
      gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
      frameloop={active ? "always" : "never"}
      aria-hidden
    >
      <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(1.5)} />
      <AdaptiveDpr pixelated />
      <Vortex state={state} animate={!reducedMotion} />
    </Canvas>
  );
}
