import type { AccountStatus } from "../api/employees.api";

/**
 * Account status — screen #9, design gap note G3: "Account status is its own axis".
 *
 * It must NOT reuse the document lifecycle hues (draft / in-review / approved …). An
 * account being "active" has nothing to do with a document being approved, and painting
 * them the same colour teaches the eye a false equivalence on a screen where colour is
 * supposed to carry meaning.
 *
 * G2: "Warnings stay neutral" — must-change and expired are sunken/neutral, not alarm
 * colours. Only a genuinely locked account is worth the danger register.
 */
const TONE: Record<AccountStatus, string> = {
  active: "border border-border bg-surface text-subdued",
  must_change: "border border-border bg-sunken text-text",
  expired: "border border-border bg-sunken text-text",
  disabled: "border border-border bg-sunken text-subdued line-through",
  locked: "border border-danger/30 bg-danger-soft text-danger-ink",
};

const LABEL: Record<AccountStatus, string> = {
  active: "Active",
  must_change: "Must change",
  expired: "Expired",
  disabled: "Disabled",
  locked: "Locked",
};

export function AccountStatusChip({ status }: { status: AccountStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-pill px-2 py-0.5 text-micro font-semibold ${TONE[status]}`}
    >
      {LABEL[status]}
    </span>
  );
}
