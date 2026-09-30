"use client";

import Form from "next/form";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/button";
import { Field, Input } from "@/components/field";
import { extraParams } from "@/lib/range";

/** GET form to the current tab through next/form; the page reads ?from=&to=, and every other query param rides along as a hidden input. */
export function DateRangeForm() {
  const pathname = usePathname();
  const params = useSearchParams();
  const extra = extraParams(params, ["from", "to"]);
  const clearQuery = new URLSearchParams(extra).toString();
  return (
    <div key={params.toString()}>
      <Form action={pathname} className="flex flex-wrap items-end gap-3">
        {extra.map(([k, v], i) => (
          <input key={i} type="hidden" name={k} value={v} />
        ))}
        <Field label="From">
          <Input type="date" name="from" defaultValue={params.get("from") ?? ""} />
        </Field>
        <Field label="To">
          <Input type="date" name="to" defaultValue={params.get("to") ?? ""} />
        </Field>
        <Button type="submit" variant="primary">Apply</Button>
        <Link href={clearQuery ? `${pathname}?${clearQuery}` : pathname} className="py-1.5 text-base text-muted hover:text-ink">
          Clear
        </Link>
      </Form>
    </div>
  );
}
