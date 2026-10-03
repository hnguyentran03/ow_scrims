import { RAMP_CLASS, RAMP_TEXT, rampStep } from "@/lib/ramp";
import { Table, Td, Th } from "./table";

export interface ShadedColumn {
  key: string;
  label: string;
  title?: string;
}

export interface ShadedCell {
  value: number | null;
  text: string;
  title?: string;
  /** Dims the text while keeping the shade, for a cell whose value stands for nothing measured. */
  muted?: boolean;
}

export interface ShadedRow {
  key: string;
  label: string;
  title?: string;
  /** Aligned with `columns`; null leaves the cell blank instead of shading it. */
  cells: (ShadedCell | null)[];
}

const DATA_WIDTH = { width: "7rem", minWidth: "7rem" } as const;

/** A pinned label column, fixed-width data columns shaded by rampStep(value), a trailing spacer, and a muted dash for a null cell. */
export function ShadedTable({ pinHead, columns, rows }: { pinHead: string; columns: ShadedColumn[]; rows: ShadedRow[] }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th pin="first">{pinHead}</Th>
          {columns.map((c) => (
            <Th key={c.key} numeric title={c.title} style={DATA_WIDTH}>{c.label}</Th>
          ))}
          <Th aria-hidden style={{ width: "auto" }} />
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key}>
            <Td pin="first" title={r.title}>{r.label}</Td>
            {r.cells.map((cell, i) => {
              if (!cell) return <Td key={columns[i].key} numeric muted style={DATA_WIDTH}>–</Td>;
              const step = rampStep(cell.value);
              return (
                <Td key={columns[i].key} numeric style={DATA_WIDTH} className={`${RAMP_CLASS[step]} ${cell.muted ? "text-muted" : RAMP_TEXT[step]}`} title={cell.title}>
                  {cell.text}
                </Td>
              );
            })}
            <Td aria-hidden />
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
