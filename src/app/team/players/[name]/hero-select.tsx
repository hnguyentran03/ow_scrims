"use client";

import Form from "next/form";
import { Button } from "@/components/button";
import { Field, Select } from "@/components/field";

/** GET form that sets ?hero= on the player page; `hidden` carries from/to along. A blank choice drops the filter. */
export function HeroSelect({ action, hidden, heroes, hero }: { action: string; hidden: Array<[string, string]>; heroes: string[]; hero: string | null }) {
  return (
    <div key={hero ?? ""}>
      <Form action={action} className="flex items-end gap-2">
        {hidden.map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <Field label="Hero">
          <Select name="hero" defaultValue={hero ?? ""}>
            <option value="">All heroes</option>
            {heroes.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </Select>
        </Field>
        <Button type="submit" variant="primary">Apply</Button>
      </Form>
    </div>
  );
}
