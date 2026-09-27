import { Tabs } from "@/components/tabs";
import { REPLAY_ENABLED } from "@/lib/flags";

const MAP_TABS = [
  { suffix: "", label: "Overview" },
  { suffix: "/killfeed", label: "Killfeed" },
  { suffix: "/charts", label: "Charts" },
  { suffix: "/events", label: "Events" },
  { suffix: "/compare", label: "Compare" },
  { suffix: "/telemetry", label: "Telemetry" },
  ...(REPLAY_ENABLED ? [{ suffix: "/replay", label: "Replay" }] : []),
];

export function MapTabs({ base }: { base: string }) {
  return <Tabs base={base} tabs={MAP_TABS} />;
}
