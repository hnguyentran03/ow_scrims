import Link from "next/link";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { Field, Input } from "@/components/field";
import { PageHeader } from "@/components/page-header";
import { Table, Td, Th } from "@/components/table";
import { getDb } from "@/lib/db";
import { listScrims } from "@/lib/db/queries";
import { createScrimAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const scrims = await listScrims(await getDb());
  return (
    <div className="space-y-8">
      <PageHeader title="Scrims" />

      <Card title="New scrim">
        <form action={createScrimAction} className="flex flex-wrap items-end gap-3">
          <Field label="Name">
            <Input name="name" required placeholder="vs Cerberus" />
          </Field>
          <Field label="Date">
            <Input name="date" type="date" required />
          </Field>
          <Field label="Opponent">
            <Input name="opponentName" required />
          </Field>
          <Button type="submit" variant="primary">Create scrim</Button>
        </form>
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
                  <Badge tone={s.wins > s.losses ? "won" : s.losses > s.wins ? "lost" : "neutral"}>{s.wins}-{s.losses}</Badge>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
