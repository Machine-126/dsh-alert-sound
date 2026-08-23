// dsh-alert-sound — Host half.
// This bundle is a pure client-side notification plugin: the detection,
// sound playback, voice and the Settings section all live in lib/client.js
// and run in the browser. The host row exists only so the bundle's
// cordis.patch.yml can register the plugin by package name (Node resolution
// needs a resolvable main module). It contributes nothing at runtime.
export const name = 'dsh-alert-sound'

export function apply() {
  // Intentionally empty. All behaviour is client-side.
}
