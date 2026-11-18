import type { JsonRecord } from "../api/procedureSampling.api";

export function ProcedureSamplingPreview({ value }: { value: unknown }) {
  const envelope = asRecord(value);
  const payload = asRecord(envelope?.data) ?? envelope;
  const record = asRecord(payload?.preview) ?? payload;
  const summary =
    record?.ai_summary ?? record?.summary ?? record?.procedure_summary;
  const diagrams = collectDiagrams(record?.diagrams, value);
  const tables =
    record?.sampling_tables ?? record?.sampling_plan ?? record?.tables;
  return (
    <section className="mt-5 rounded-card border border-primary/20 bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-h3 font-semibold">Generated Preview</h3>
        {envelope?.procedure_status ? (
          <span className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-micro font-semibold capitalize text-primary-dark">
            {String(envelope.procedure_status)}
          </span>
        ) : null}
      </div>
      {summary ? (
        <div className="mt-4">
          <h4 className="text-small font-semibold">AI Summary</h4>
          {Array.isArray(summary) ? (
            <ul className="mt-2 space-y-2">
              {summary.map((step, index) => (
                <li key={index} className="flex gap-3 text-small leading-6">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                  <span className="whitespace-pre-wrap">{display(step)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-1 whitespace-pre-wrap text-small">
              {typeof summary === "string" ? summary : JSON.stringify(summary, null, 2)}
            </div>
          )}
        </div>
      ) : null}
      {tables ? (
        <div className="mt-4">
          <h4 className="mb-2 text-small font-semibold">Sampling Tables</h4>
          <GeneratedTables value={tables} />
        </div>
      ) : null}
      {diagrams.length ? (
        <div className="mt-4">
          <h4 className="mb-2 text-small font-semibold">Generated Diagrams</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            {diagrams.map((url, i) => (
              <img
                key={`${url.src}-${i}`}
                src={url.src}
                alt={url.title || `Generated sampling diagram ${i + 1}`}
                className="max-h-[420px] w-full rounded-control border border-border object-contain"
              />
            ))}
          </div>
        </div>
      ) : null}
      {Array.isArray(record?.diagrams) && record.diagrams.length === 0 ? (
        <p className="mt-4 text-small text-subdued">No diagrams were generated for this stage.</p>
      ) : null}
      {!summary && !tables && !diagrams.length ? (
        <pre className="mt-3 overflow-auto rounded-control bg-muted p-3 text-micro">
          {JSON.stringify(value, null, 2)}
        </pre>
      ) : null}
    </section>
  );
}
function GeneratedTables({ value }: { value: unknown }) {
  const tableValue = asRecord(value);
  const declaredTables = Array.isArray(value)
    ? value
    : tableValue && Array.isArray(tableValue.columns)
      ? [tableValue]
      : null;
  if (
    declaredTables?.some((item) => item && typeof item === "object" && Array.isArray(item.columns))
  ) {
    return (
      <div className="grid gap-4">
        {declaredTables.map((item, index) =>
          item && typeof item === "object" && Array.isArray(item.columns) ? (
            <DeclaredSamplingTable key={`${item.title ?? "sampling"}-${index}`} table={item as JsonRecord} />
          ) : null,
        )}
      </div>
    );
  }
  const entries = Array.isArray(value)
    ? [["Sampling", value] as const]
    : value && typeof value === "object"
      ? Object.entries(value as JsonRecord)
      : [["Sampling", value] as const];
  return (
    <div className="grid gap-3">
      {entries.map(([title, rows], i) => {
        const list = Array.isArray(rows) ? rows : [rows];
        const columns = [
          ...new Set(
            list.flatMap((row) =>
              row && typeof row === "object" ? Object.keys(row) : ["value"],
            ),
          ),
        ];
        return (
          <div
            key={`${title}-${i}`}
            className="overflow-x-auto rounded-control border border-border"
          >
            <h5 className="bg-muted px-3 py-2 text-micro font-semibold">
              {label(String(title))}
            </h5>
            <table className="w-full min-w-[420px] text-left text-small">
              <thead>
                <tr>
                  {columns.map((key) => (
                    <th
                      key={key}
                      className="px-3 py-2 text-micro uppercase text-subdued"
                    >
                      {label(key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-t border-border">
                    {columns.map((key) => (
                      <td key={key} className="px-3 py-2">
                        {display(
                          row && typeof row === "object" ? row[key] : row,
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

function DeclaredSamplingTable({ table }: { table: JsonRecord }) {
  const rows = toList(table.rows ?? table.sampling_rows ?? table.data);
  const columns = table.columns as unknown[];
  return (
    <div className="overflow-hidden rounded-control border border-border">
      <h5 className="bg-muted px-3 py-2.5 text-small font-semibold">
        {String(table.title ?? "Sampling")}
      </h5>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-small">
          <thead className="border-y border-border bg-muted/40">
            <tr>
              {columns.map((column, index) => (
                <th key={`${String(column)}-${index}`} className="px-3 py-2.5 text-micro font-semibold uppercase tracking-wide text-subdued">
                  {label(String(column))}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-t border-border align-top">
                {columns.map((column, columnIndex) => (
                  <td key={`${String(column)}-${columnIndex}`} className="min-w-28 px-3 py-3 leading-5">
                    {display(getCell(row, String(column), columnIndex))}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr><td colSpan={Math.max(columns.length, 1)} className="px-3 py-5 text-center text-subdued">No sampling rows.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function getCell(row: unknown, column: string, index: number): unknown {
  if (Array.isArray(row)) return row[index];
  if (!row || typeof row !== "object") return index === 0 ? row : "";
  const record = row as JsonRecord;
  return (
    record[column] ??
    record[camelCase(column)] ??
    record[snakeCase(column)] ??
    ""
  );
}

function toList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value);
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : parsed && typeof parsed === "object" ? Object.values(parsed) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function collectDiagrams(value: unknown, fallback: unknown): { src: string; title?: string }[] {
  if (Array.isArray(value)) {
    const diagrams = value.flatMap((diagram) => {
      if (typeof diagram === "string") return isImageSource(diagram) ? [{ src: diagram }] : [];
      if (!diagram || typeof diagram !== "object") return [];
      const item = diagram as JsonRecord;
      const src = item.url ?? item.image_url ?? item.data_url ?? item.src ?? item.image;
      return typeof src === "string" && isImageSource(src)
        ? [{ src, title: typeof (item.title ?? item.label) === "string" ? String(item.title ?? item.label) : undefined }]
        : [];
    });
    if (diagrams.length) return diagrams;
  }
  return collectDataUrls(fallback).map((src) => ({ src }));
}

function collectDataUrls(value: unknown): string[] {
  if (typeof value === "string") return value.startsWith("data:image/") ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(collectDataUrls);
  if (value && typeof value === "object") return Object.values(value).flatMap(collectDataUrls);
  return [];
}

function isImageSource(value: string) {
  return value.startsWith("data:image/") || /^https?:\/\//i.test(value) || value.startsWith("/");
}

function camelCase(value: string) {
  return value.replace(/\s+([a-z])/gi, (_, character: string) => character.toUpperCase());
}

function snakeCase(value: string) {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function label(value: string) {
  return value.replace(/_/g, " ");
}
function display(value: any): string {
  return value == null
    ? ""
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);
}
