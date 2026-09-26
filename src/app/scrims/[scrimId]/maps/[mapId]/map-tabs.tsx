import { Tabs } from "@/components/tabs";

const MAP_TABS = [
  { suffix: "", label: "Overview" },
  { suffix: "/killfeed", label: "Killfeed" },
  { suffix: "/charts", label: "Charts" },
  { suffix: "/events", label: "Events" },
  { suffix: "/compare", label: "Compare" },
  { suffix: "/telemetry", label: "Telemetry" },
] as const;

export function MapTabs({ base }: { base: string }) {
  return <Tabs base={base} tabs={MAP_TABS} />;
}
