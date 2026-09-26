/** A tab is active on its own path, or on a nested route when its suffix is non-empty (so the base tab never claims every route). */
export function isActiveTab(pathname: string, path: string, suffix: string): boolean {
  return pathname === path || (suffix !== "" && pathname.startsWith(`${path}/`));
}
