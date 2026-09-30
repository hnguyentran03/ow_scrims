"use client";

import { useActionState } from "react";
import { Button } from "@/components/button";
import { Field, Input } from "@/components/field";
import { EMPTY_SCRIM_STATE } from "@/lib/scrim-input";
import { createScrimAction } from "./actions";

export function CreateScrimForm() {
  const [state, action, pending] = useActionState(createScrimAction, EMPTY_SCRIM_STATE);
  return (
    <form action={action} className="flex flex-wrap items-start gap-3">
      <Field label="Name" error={state.errors.name}>
        <Input name="name" defaultValue={state.values.name} placeholder="vs Cerberus" />
      </Field>
      <Field label="Date" error={state.errors.date}>
        <Input name="date" type="date" defaultValue={state.values.date} />
      </Field>
      <Field label="Opponent" error={state.errors.opponentName}>
        <Input name="opponentName" defaultValue={state.values.opponentName} />
      </Field>
      <Button type="submit" variant="primary" pending={pending} pendingLabel="Creating…" className="mt-5">Create scrim</Button>
    </form>
  );
}
