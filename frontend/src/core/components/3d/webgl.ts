let supported: boolean | undefined;

/**
 * Can this browser create a WebGL context? False with hardware acceleration off, in some
 * locked-down or headless browsers, and on very old devices. three.js throws in that case and
 * takes the page down, so every scene checks this first and is simply left out. Probed once.
 */
export function webglAvailable(): boolean {
  if (supported !== undefined) return supported;
  try {
    const gl = document.createElement("canvas").getContext("webgl2") ?? document.createElement("canvas").getContext("webgl");
    supported = gl !== null;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    supported = false;
  }
  return supported;
}
