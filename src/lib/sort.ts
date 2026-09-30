/** Comparator over one key: numbers numerically, anything else by localeCompare on its string form. `dir` 1 ascends, -1 descends. */
export function compareBy<T>(key: keyof T, dir: 1 | -1): (a: T, b: T) => number {
  return (a, b) => {
    const av = a[key];
    const bv = b[key];
    const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
    return cmp * dir;
  };
}
