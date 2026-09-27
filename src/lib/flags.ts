/**
 * Feature flags for work that is merged but not yet ready for users.
 *
 * The map replay viewer (phase 7) is shipped without map images or overlays,
 * so its tab is hidden and its route 404s until the rest lands. Flip this to
 * re-enable it.
 */
export const REPLAY_ENABLED = false;
