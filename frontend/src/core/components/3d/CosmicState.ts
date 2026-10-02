/**
 * Mutable camera/vortex targets shared between DOM controllers (scroll,
 * hover) and the WebGL scene. Plain fields so Anime.js can tween them
 * directly and the render loop can read them without React re-renders.
 */
export class CosmicState {
  /** Extra rotation in radians, added on top of the ambient spin. */
  spin = 0;
  /** Disc tilt towards the camera, in radians (0 = face-on). */
  tilt = 1.05;
  /** Camera distance from the vortex core. */
  zoom = 9;
  /** 0..1 pulse that pulls the arms inward during a transition. */
  warp = 0;
}
