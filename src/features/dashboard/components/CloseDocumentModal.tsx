import { useEffect, useRef, useState, type FormEvent } from "react";
import type { DashboardItem } from "../api/dashboard.api";
export type CloseMode = "delete" | "cancel";

export function CloseDocumentModal({ mode, item, error, onDismiss, onConfirm }: {
  mode: CloseMode;
  item: DashboardItem;
  error: string | null;
  onDismiss: () => void;
  onConfirm: (input: { category: string; reason: string; password: string }) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [category, setCategory] = useState("");
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const cancel = mode === "cancel";
  const allowed = cancel ? item.permissions.can_cancel : item.permissions.can_delete;
  const valid = allowed && category.trim().length > 0 && reason.trim().length >= 10 && (!cancel || password.length > 0);
  const title = cancel ? "Cancel record" : "Delete draft";
  const inputClass = "mt-1 w-full rounded-control border border-border-strong bg-surface p-2 text-small";
  useEffect(() => { dialog.current?.showModal(); }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    try { await onConfirm({ category: category.trim(), reason: reason.trim(), password }); }
    finally { setBusy(false); }
  }
  return (
    <dialog ref={dialog} aria-labelledby="close-document-title" onCancel={(event) => {
      event.preventDefault(); if (!busy) onDismiss();
    }} className="w-full max-w-lg rounded-card border border-border bg-surface p-6 text-text shadow-modal backdrop:bg-black/40">
      <form onSubmit={(event) => void submit(event)} className="space-y-4">
        <h2 id="close-document-title" className="text-h2 font-semibold">{title} · {item.display_id}</h2>
        <p className="text-small text-subdued">{cancel
          ? "The record and its audit history will be retained. Enter your password to sign the cancellation."
          : "This removes the draft permanently. Its audit history is retained."}</p>
        <label className="block text-small">Category
          <input autoFocus required maxLength={120} value={category} disabled={busy} onChange={(event) => setCategory(event.target.value)} className={inputClass} />
        </label>
        <label className="block text-small">Reason (at least 10 characters)
          <textarea required minLength={10} maxLength={2000} value={reason} disabled={busy} onChange={(event) => setReason(event.target.value)} className={inputClass} />
        </label>
        {cancel ? <label className="block text-small">Your password
          <input type="password" autoComplete="current-password" required value={password} disabled={busy} onChange={(event) => setPassword(event.target.value)} className={inputClass} />
        </label> : null}
        {error ? <p role="alert" className="text-small text-danger">{error}</p> : null}
        <div className="flex justify-end gap-3">
          <button type="button" disabled={busy} onClick={onDismiss} className="rounded-control border border-border px-4 py-2 text-small">Keep document</button>
          <button type="submit" disabled={busy || !valid} className="rounded-control bg-danger px-4 py-2 text-small font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : title}</button>
        </div>
      </form>
    </dialog>
  );
}
