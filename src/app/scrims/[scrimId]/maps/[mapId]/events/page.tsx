import { getEventRows } from "@/lib/db/queries";
import { buildEvents } from "@/lib/stats/events";
import { loadMap, type MapParams } from "../load-map";
import { EventsList } from "./events-list";

export const dynamic = "force-dynamic";

export default async function EventsPage({ params }: { params: MapParams }) {
  const { db, map, sides } = await loadMap(params);
  const rows = await getEventRows(db, map.id);
  const events = buildEvents(map, rows);
  return <EventsList events={events} sides={sides} />;
}
