import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/scrims/[scrimId]/maps/route";

const call = (scrimId: string) => POST(new Request("http://x/api", { method: "POST", headers: { "content-length": "0" } }), { params: Promise.resolve({ scrimId }) } as never);

describe("upload route id parsing", () => {
  it.each(["0", "-1", "1.5", "01", "2147483648", "abc"])("rejects %s with 400", async (id) => {
    const res = await call(id);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid scrim id" });
  });
});
