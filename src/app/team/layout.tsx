import { Suspense } from "react";
import { Tabs } from "@/components/tabs";
import { DateRangeForm } from "./date-range-form";
import { TEAM_TABS } from "./tabs";

export const dynamic = "force-dynamic";

export default function TeamLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold">Team</h1>
        <Suspense fallback={null}>
          <DateRangeForm />
        </Suspense>
      </header>
      <Suspense fallback={null}>
        <Tabs base="/team" tabs={TEAM_TABS} />
      </Suspense>
      {children}
    </div>
  );
}
