const LOG_NAME = /\.(txt|log)$/i;
export const BAD_FILES = "Choose one or more .txt or .log Workshop logs.";

/** The non-empty files from a form's `files` entries, or one error sentence when none qualify or any has the wrong extension. */
export function pickLogFiles(entries: FormDataEntryValue[]): { files: File[]; error: string | null } {
  const files = entries.filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0 || files.some((f) => !LOG_NAME.test(f.name))) return { files: [], error: BAD_FILES };
  return { files, error: null };
}
