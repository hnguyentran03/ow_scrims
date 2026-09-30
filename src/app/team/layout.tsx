import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Tabs } from "@/components/tabs";
import { DateRangeForm } from "./date-range-form";
import { TEAM_TABS } from "./tabs";

export const dynamic = "force-dynamic";

export default function TeamLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <PageHeader title="Team">
        <Suspense fallback={null}>
          <DateRangeForm />
        </Suspense>
      </PageHeader>
      <Suspense fallback={null}>
        <Tabs base="/team" tabs={TEAM_TABS} />
      </Suspense>
      {children}
    </div>
  );
}
