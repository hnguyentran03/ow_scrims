import { randomUUID } from "node:crypto";

/** Cookie that carries a visitor's sandbox id. A session cookie: no Max-Age. */
export const SANDBOX_COOKIE = "sb";
/** Every sandbox database is named with this prefix; the startup sweep drops everything that matches it. */
export const SANDBOX_DB_PREFIX = "ow_sb_";

const ID_RE = /^[0-9a-f]{32}$/;

/** The only user-controlled input that reaches a database name, so this check is the whole injection surface. */
export function isSandboxId(v: unknown): v is string {
  return typeof v === "string" && ID_RE.test(v);
}

export function newSandboxId(): string {
  return randomUUID().replaceAll("-", "");
}

export function sandboxDbName(id: string): string {
  if (!isSandboxId(id)) throw new Error("invalid sandbox id");
  return `${SANDBOX_DB_PREFIX}${id}`;
}
