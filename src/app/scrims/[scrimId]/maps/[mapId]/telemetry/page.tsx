import { getTelemetryRows } from "@/lib/db/queries";
import { buildTelemetry } from "@/lib/stats/telemetry";
import { loadMap, type MapParams } from "../load-map";
import { TelemetryPanel } from "./telemetry-panel";

export const dynamic = "force-dynamic";

export default async function TelemetryPage({ params }: { params: MapParams }) {
  const { db, map, sides } = await loadMap(params);
  const rows = await getTelemetryRows(db, map.id);
  const telemetry = buildTelemetry({ map, damage: rows.damage, playerStats: rows.playerStats });
  return <TelemetryPanel telemetry={telemetry} sides={sides} />;
}
