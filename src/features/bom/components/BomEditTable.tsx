import { Loader2, Save, X } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import type { BomIngredient } from "../api/bom.types";

/** One edited cell, filed as a correction against the BOM row when saved. */
export interface BomFieldChange {
  row_index: number;
  sr_no: number | null;
  material_code: string | null;
  field: string;
  label: string;
  from: string;
  to: string;
}

interface EditableRow {
  sr_no: string;
  material_code: string;
  name: string;
  specification: string;
  label_claim: string;
  qty_required: string;
  uom: string;
}

/**
 * Columns and names taken verbatim from the printed "2.1 Total Material Requirement"
 * table, so the edit view reads the same as the document it feeds. Layer and Part are
 * NOT columns here — they group the rows as full-width sub-headers, exactly as on 2.1.
 */
const COLUMNS: { key: keyof EditableRow; label: string; className?: string; numeric?: boolean; editable?: boolean }[] = [
  { key: "sr_no", label: "Sr. No.", className: "w-16", numeric: true, editable: true },
  { key: "material_code", label: "Material Code", className: "w-32" },
  { key: "name", label: "Ingredients", className: "min-w-[13rem]", editable: true },
  { key: "specification", label: "Spec.", className: "w-24" },
  { key: "label_claim", label: "Label Claim mg./Tab", className: "w-28", numeric: true },
  { key: "qty_required", label: "Qty. Required", className: "w-28", numeric: true },
  { key: "uom", label: "U O M", className: "w-20", editable: true },
];

/** Which BomIngredient field each editable column maps to — used to label the correction. */
const FIELD_NAME: Record<keyof EditableRow, string> = {
  sr_no: "sr_no",
  material_code: "material_code",
  name: "name",
  specification: "specification",
  label_claim: "label_claim_mg_per_unit",
  qty_required: "qty_required_production",
  uom: "uom",
};

interface BomEditTableProps {
  ingredients: BomIngredient[];
  onSave: (changes: BomFieldChange[]) => void;
  onCancel: () => void;
  saving?: boolean;
  children?: React.ReactNode;
}

interface Group {
  key: string;
  part: string;
  layer: string | null;
  /** Indices into the original `ingredients` array — kept so corrections map back. */
  rows: number[];
}

/**
 * The Bill of Materials as an editable, ruled table styled like printed table 2.1
 * (screen #20). Rows are grouped Part → Layer with full-width sub-headers; every data
 * cell is a text input. Editing here is how corrections are made ("in the structured
 * table, never inside the Word document"): only the cells the user changed are filed
 * on save.
 */
export function BomEditTable({ ingredients, onSave, onCancel, saving = false, children }: BomEditTableProps) {
  const [rows, setRows] = useState<EditableRow[]>(() => ingredients.map(toRow));

  const groups = useMemo<Group[]>(() => groupRows(ingredients), [ingredients]);

  // The printed "second line" under every API / $#-compensated diluent is editable too —
  // its own state, keyed by the parent ingredient's index. Seeded from what the document
  // shows on that line (code · name · spec · uom; Sr / label-claim / qty blank).
  const [dupRows, setDupRows] = useState<Record<number, EditableRow>>(() => {
    const seed: Record<number, EditableRow> = {};
    ingredients.forEach((ing, i) => {
      if (ing.is_api || ing.is_compensated) seed[i] = toDupRow(ing);
    });
    return seed;
  });

  const setCell = (index: number, field: keyof EditableRow, value: string) => {
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  };

  const setDupCell = (index: number, field: keyof EditableRow, value: string) => {
    setDupRows((current) => ({ ...current, [index]: { ...current[index], [field]: value } }));
  };

  // Field-level diff against the extracted values — only changed cells are sent. Subtotal
  // ("Avg. wt.") rows are read-only and never diffed. The second-line (duplicate) rows are
  // diffed against what the document seeds them with, and filed as "(2nd line)" corrections.
  const changes = useMemo<BomFieldChange[]>(() => {
    const out: BomFieldChange[] = [];
    ingredients.forEach((original, index) => {
      if (original.is_avg_weight) return;

      const edited = rows[index];
      if (edited) {
        const originalRow = toRow(original);
        for (const col of COLUMNS) {
          if (!col.editable) continue;
          const to = edited[col.key].trim();
          if (to !== originalRow[col.key]) {
            out.push({
              row_index: index,
              sr_no: original.sr_no,
              material_code: original.material_code,
              field: FIELD_NAME[col.key],
              label: col.label.replace(/\.$/, ""),
              from: originalRow[col.key],
              to,
            });
          }
        }
      }

    });
    return out;
  }, [ingredients, rows, dupRows]);

  // Which primary / second-line rows have pending edits (for the row highlight).
  const changedRows = useMemo(() => new Set(changes.filter((c) => !c.field.endsWith("__2")).map((c) => c.row_index)), [changes]);
  const changedDup = useMemo(() => new Set(changes.filter((c) => c.field.endsWith("__2")).map((c) => c.row_index)), [changes]);

  return (
    <>
      <section className="min-h-0 overflow-hidden rounded-card border border-border bg-surface mx-8 shadow-sm">
        <header className="border-b border-border px-5 py-4">
          <h2 className="text-h2 font-semibold">2.1 Total material requirement</h2>
          <p className="mt-0.5 text-small text-subdued">
            {ingredients.length} extracted rows. Only changed cells are sent when you save.
          </p>
        </header>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-small">
            <thead>
              <tr className="text-left text-micro uppercase tracking-overline text-subdued">
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className={`border border-border px-3 py-2.5 font-semibold ${col.numeric ? "text-right" : ""} ${col.className ?? ""}`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <GroupBlock
                  key={group.key}
                  group={group}
                  ingredients={ingredients}
                  rows={rows}
                  dupRows={dupRows}
                  changedRows={changedRows}
                  changedDup={changedDup}
                  onCell={setCell}
                  onDupCell={setDupCell}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {children}

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t bg-surface p-3.5 shadow-auth">
        <p className="text-small text-subdued">
          Edit any cell, then save.{" "}
          {changes.length > 0 ? (
            <span className="font-semibold text-text">
              {changes.length} change{changes.length === 1 ? "" : "s"} pending
            </span>
          ) : (
            "No changes yet."
          )}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-control border border-border px-4 py-2 text-small font-semibold transition hover:bg-muted disabled:opacity-50"
          >
            <X className="size-4" aria-hidden="true" />
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(changes)}
            disabled={saving || changes.length === 0}
            className="inline-flex items-center gap-2 rounded-control bg-primary px-4 py-2 text-small font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="size-4" aria-hidden="true" />
            )}
            Save changes
          </button>
        </div>
      </div>
    </>
  );
}

function GroupBlock({
  group,
  ingredients,
  rows,
  dupRows,
  changedRows,
  changedDup,
  onCell,
  onDupCell,
}: {
  group: Group;
  ingredients: BomIngredient[];
  rows: EditableRow[];
  dupRows: Record<number, EditableRow>;
  changedRows: Set<number>;
  changedDup: Set<number>;
  onCell: (index: number, field: keyof EditableRow, value: string) => void;
  onDupCell: (index: number, field: keyof EditableRow, value: string) => void;
}) {
  return (
    <>
      {/* Part → Layer band, spanning the full width — the "Paracetamol Layer" /
          "Dry mixing Part" sub-headers on printed 2.1. */}
      <tr>
        <td
          colSpan={COLUMNS.length}
          className="border border-border bg-primary/10 px-3 py-1.5 text-center text-micro font-semibold uppercase tracking-overline text-text"
        >
          {group.part}
          {group.layer ? (
            <span className="ml-2 font-normal normal-case tracking-normal text-subdued">
              {group.layer}
            </span>
          ) : null}
        </td>
      </tr>

      {group.rows.map((index) => {
        const original = ingredients[index];

        // Subtotal rows ("Avg. wt. of X Tablet") are not ingredients — read-only.
        if (original.is_avg_weight) {
          return (
            <tr key={index} className="bg-sunken/40 font-semibold">
              <td className="border border-border px-3 py-2" />
              <td className="border border-border px-3 py-2" />
              <td className="border border-border px-3 py-2">{original.name}</td>
              <td className="border border-border px-3 py-2" />
              <td className="border border-border px-3 py-2 text-right tabular-nums">
                {num(original.label_claim_mg_per_unit)}
              </td>
              <td className="border border-border px-3 py-2 text-right tabular-nums">
                {num(original.qty_required_production)}
              </td>
              <td className="border border-border px-3 py-2" />
            </tr>
          );
        }

        const edited = rows[index];
        const isChanged = changedRows.has(index);
        return (
          <Fragment key={index}>
            <tr className={isChanged ? "bg-accent-soft/40" : "hover:bg-muted/50"}>
              {COLUMNS.map((col) => (
                <td key={col.key} className="border border-border px-2 py-1.5 align-middle">
                  {col.editable ? <input
                      type="text"
                      inputMode={col.numeric ? "decimal" : "text"}
                      value={edited[col.key]}
                      onChange={(event) => onCell(index, col.key, event.target.value)}
                      className={`w-full rounded-control border border-border bg-surface px-2 py-1.5 text-small outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30 ${col.numeric ? "text-right tabular-nums" : ""}`}
                    /> : <span className={`block px-2 py-1.5 text-subdued ${col.numeric ? "text-right tabular-nums" : ""}`}>{edited[col.key] || "—"}</span>}
                </td>
              ))}
            </tr>
            {/* The printed 2.1 repeats every API and every $/#-compensated diluent as a
                second line (potency A.R. / excipient adjustment). It is editable too — its
                cells are seeded from what the document shows and saved as "(2nd line)"
                corrections. Tinted so it reads as a continuation of the row above. */}
            {(original.is_api || original.is_compensated) && dupRows[index] ? (
              <tr className={changedDup.has(index) ? "bg-accent-soft/40" : "bg-sunken/30"}>
                {COLUMNS.map((col) => (
                  <td key={col.key} className="border border-border px-2 py-1.5 align-middle">
                    <span className={`block px-2 py-1.5 text-subdued ${col.numeric ? "text-right tabular-nums" : ""}`}>{dupRows[index][col.key] || "—"}</span>
                  </td>
                ))}
              </tr>
            ) : null}
          </Fragment>
        );
      })}
    </>
  );
}

/** Grouped Part → Layer, preserving each row's original index for the correction diff. */
function groupRows(ingredients: BomIngredient[]): Group[] {
  const map = new Map<string, Group>();
  ingredients.forEach((row, index) => {
    const part = row.part || "Formulation";
    const layer = row.layer || null;
    const key = `${part}::${layer ?? ""}`;
    const existing = map.get(key);
    if (existing) {
      existing.rows.push(index);
    } else {
      map.set(key, { key, part, layer, rows: [index] });
    }
  });
  return [...map.values()];
}

function num(value: number | null): string {
  return value != null ? String(value) : "";
}

function toRow(original: BomIngredient): EditableRow {
  const text = (value: string | null) => value ?? "";
  return {
    sr_no: num(original.sr_no),
    material_code: text(original.material_code),
    name: original.name ?? "",
    specification: text(original.specification),
    label_claim: num(original.label_claim_mg_per_unit),
    qty_required: num(original.qty_required_production),
    uom: text(original.uom),
  };
}

/**
 * The second-line ("duplicate") row as the document seeds it: material code, name, spec and
 * UOM are repeated from the ingredient; Sr. No., label claim and qty are blank (filled by
 * hand). Edits are diffed against this seed.
 */
function toDupRow(original: BomIngredient): EditableRow {
  const text = (value: string | null) => value ?? "";
  return {
    sr_no: "",
    material_code: text(original.material_code),
    name: original.name ?? "",
    specification: text(original.specification),
    label_claim: "",
    qty_required: "",
    uom: text(original.uom),
  };
}
