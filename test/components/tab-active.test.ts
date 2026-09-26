import { describe, expect, it } from "vitest";
import { isActiveTab } from "@/components/tab-active";

describe("isActiveTab", () => {
  it("matches the exact path always and nested routes only for non-empty suffixes", () => {
    expect(isActiveTab("/team", "/team", "")).toBe(true);
    expect(isActiveTab("/team/players", "/team", "")).toBe(false);
    expect(isActiveTab("/team/players", "/team/players", "/players")).toBe(true);
    expect(isActiveTab("/team/players/4head%20Dog", "/team/players", "/players")).toBe(true);
    expect(isActiveTab("/team/playersx", "/team/players", "/players")).toBe(false);
    expect(isActiveTab("/team/trends", "/team/players", "/players")).toBe(false);
  });
});
