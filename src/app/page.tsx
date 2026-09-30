import Link from "next/link";
import { Badge } from "@/components/badge";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Table, Td, Th } from "@/components/table";
import { getDb } from "@/lib/db";
import { listScrims } from "@/lib/db/queries";
import { recordTone } from "@/lib/result";
import { CreateScrimForm } from "./create-scrim-form";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const scrims = await listScrims(await getDb());
  return (
    <div className="space-y-8">
      <PageHeader title="Scrims" />

      <Card title="New scrim">
        <CreateScrimForm />
      </Card>

      {scrims.length === 0 ? (
        <EmptyState>No scrims yet. Create one above, then upload a map log.</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Scrim</Th>
              <Th>Date</Th>
              <Th>Opponent</Th>
              <Th numeric>Maps</Th>
              <Th numeric>Record</Th>
            </tr>
          </thead>
          <tbody>
            {scrims.map((s) => (
              <tr key={s.id}>
                <Td><Link href={`/scrims/${s.id}`} className="font-medium hover:underline">{s.name}</Link></Td>
                <Td muted>{s.date}</Td>
                <Td muted>{s.opponentName}</Td>
                <Td numeric>{s.mapCount}</Td>
                <Td numeric>
                  <Badge tone={recordTone(s.wins, s.losses)}>{s.wins}-{s.losses}</Badge>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
