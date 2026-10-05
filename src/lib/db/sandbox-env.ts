/**
 * Sandbox mode's configuration, split out of sandbox.ts so the hot path in
 * src/lib/db/index.ts can ask "is sandbox mode on?" without pulling in `pg`:
 * nothing here may import the Postgres driver, directly or transitively.
 */

export interface SandboxEnv {
  adminUrl: string;
  templateDb: string;
  publicDb: string;
  uploadRoot: string;
  idleMs: number;
  max: number;
  /** Most `map` rows one visitor's sandbox may hold before uploads are refused. */
  maxMaps: number;
  /** Most sandbox clones this process will start in any one minute. */
  createsPerMinute: number;
}

const DEFAULT_IDLE_MINUTES = 120;
const DEFAULT_MAX = 20;
const DEFAULT_MAX_MAPS = 40;
const DEFAULT_CREATES_PER_MINUTE = 10;

function positiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/** Sandbox mode needs a Postgres URL and a template name; anything else is today's single-database behaviour. */
export function sandboxEnv(env: Partial<NodeJS.ProcessEnv> = process.env): SandboxEnv | null {
  const url = env.DATABASE_URL ?? "";
  const templateDb = env.SANDBOX_TEMPLATE_DB;
  if (!templateDb || !(url.startsWith("postgres://") || url.startsWith("postgresql://"))) return null;
  return {
    adminUrl: url,
    templateDb,
    publicDb: env.SANDBOX_PUBLIC_DB ?? "ow_public",
    uploadRoot: env.SANDBOX_UPLOAD_ROOT ?? "/var/lib/ow-scrims/sandboxes",
    idleMs: positiveInt(env.SANDBOX_IDLE_MINUTES, DEFAULT_IDLE_MINUTES) * 60_000,
    max: positiveInt(env.SANDBOX_MAX, DEFAULT_MAX),
    maxMaps: positiveInt(env.SANDBOX_MAX_MAPS, DEFAULT_MAX_MAPS),
    createsPerMinute: positiveInt(env.SANDBOX_CREATES_PER_MINUTE, DEFAULT_CREATES_PER_MINUTE),
  };
}

export function sandboxMode(): boolean {
  return sandboxEnv() !== null;
}

/** The per-sandbox map quota. Falls back to the default outside sandbox mode, where nothing reads it. */
export function sandboxMaxMaps(): number {
  return sandboxEnv()?.maxMaps ?? DEFAULT_MAX_MAPS;
}
