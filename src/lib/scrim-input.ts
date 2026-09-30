export interface ScrimInput {
  name: string;
  date: string;
  opponentName: string;
}

export type ScrimFieldErrors = Partial<Record<keyof ScrimInput, string>>;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Trims the three create-scrim fields and reports one message per bad field; `errors` is null when all are fine. */
export function validateScrimInput(raw: { name: unknown; date: unknown; opponentName: unknown }): { values: ScrimInput; errors: ScrimFieldErrors | null } {
  const values: ScrimInput = {
    name: String(raw.name ?? "").trim(),
    date: String(raw.date ?? "").trim(),
    opponentName: String(raw.opponentName ?? "").trim(),
  };
  const errors: ScrimFieldErrors = {};
  if (!values.name) errors.name = "Give the scrim a name.";
  if (!DATE.test(values.date)) errors.date = "Pick a date.";
  if (!values.opponentName) errors.opponentName = "Name the opponent.";
  return { values, errors: Object.keys(errors).length ? errors : null };
}

/** The `useActionState` shape for the create-scrim form. */
export interface CreateScrimState {
  values: ScrimInput;
  errors: ScrimFieldErrors;
}

export const EMPTY_SCRIM_STATE: CreateScrimState = { values: { name: "", date: "", opponentName: "" }, errors: {} };
