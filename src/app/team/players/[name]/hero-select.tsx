"use client";

/** GET form that sets ?hero= on the player page; `hidden` carries from/to along. A blank choice drops the filter. */
export function HeroSelect({ action, hidden, heroes, hero }: { action: string; hidden: Array<[string, string]>; heroes: string[]; hero: string | null }) {
  return (
    <form key={hero ?? ""} method="get" action={action} className="flex items-center gap-2 text-sm">
      {hidden.map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <label className="flex items-center gap-2">
        Hero
        <select name="hero" defaultValue={hero ?? ""} onChange={(e) => e.currentTarget.form?.requestSubmit()} className="rounded bg-zinc-900 px-2 py-1">
          <option value="">All heroes</option>
          {heroes.map((h) => (
            <option key={h} value={h}>{h}</option>
          ))}
        </select>
      </label>
      <noscript>
        <button type="submit" className="rounded bg-orange-500 px-3 py-1 font-medium text-black">Apply</button>
      </noscript>
    </form>
  );
}
