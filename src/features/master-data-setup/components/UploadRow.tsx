import { Check, Eye, FileText, RefreshCw, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Identifier } from "../../../shared/ui/Identifier";
import { USER_ROLE_LABELS } from "../../auth/model/roles";
import { useAuthStore } from "../../auth/state/auth.store";
import type { DocDef, UploadedFile } from "../model/setup.model";
import { DocumentPreviewDialog } from "./DocumentPreviewDialog";

/**
 * One "upload the blank approved master format for this document" row. Clicking the drop
 * zone (or Replace) opens a real file picker; a dropped file works too. The chosen file's
 * actual name, size and format are captured — PDF/DOCX only, else an inline error. A
 * preparer (read-only) can Preview but not change anything.
 */
export function UploadRow({
  doc,
  letter,
  file,
  canEdit,
  onUpload,
  onRemove,
  onPreview,
}: {
  doc: DocDef;
  letter?: string;
  file: UploadedFile | null;
  canEdit: boolean;
  onUpload: (file: UploadedFile) => void;
  onRemove: () => void;
  onPreview?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const byLabel = user ? `${user.username} (${USER_ROLE_LABELS[user.role]})` : "You";

  const openPicker = () => inputRef.current?.click();

  const handlePreview = () => {
    if (onPreview) {
      onPreview();
    } else {
      setIsPreviewOpen(true);
    }
  };

  function accept(picked: File | undefined) {
    if (!picked) return;
    const format = detectFormat(picked.name);
    if (!format) {
      setError(`${picked.name} — unsupported format. Upload PDF or DOCX only.`);
      return;
    }
    if (picked.size > 25 * 1024 * 1024) {
      setError(`${picked.name} — too large. Max 25 MB.`);
      return;
    }
    setError(null);
    const blobUrl = URL.createObjectURL(picked);
    onUpload({
      filename: picked.name,
      sizeKB: Math.max(1, Math.round(picked.size / 1024)),
      by: byLabel,
      at: nowStamp(),
      format,
      blobUrl,
    });
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border/70 px-4 py-3 first:border-t-0 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        {letter ? (
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-sunken text-[10px] font-semibold text-subdued">
            {letter}
          </span>
        ) : null}
        <div className="min-w-0">
          <p className="text-small font-semibold text-text">
            {doc.name} {doc.required ? <span className="text-danger-ink">*</span> : null}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-micro text-subdued">
            <Identifier>{doc.code}</Identifier> · {doc.required ? "Required" : "Optional"}
          </p>
        </div>
      </div>

      <div className="w-full sm:w-[52%]">
        {/* Real file input — one per row, hidden. */}
        {canEdit ? (
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(e) => {
              accept(e.target.files?.[0]);
              e.target.value = ""; // allow re-selecting the same file
            }}
          />
        ) : null}

        {file ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-card border border-border bg-surface px-3 py-2">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-approved-bg text-approved-fg">
              <Check className="size-3.5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate">
                <Identifier className="text-small text-text">{file.filename}</Identifier>{" "}
                <span className="text-micro text-subdued">· {formatSize(file.sizeKB)}</span>
              </p>
              <p className="text-micro text-subdued">{file.by} · {file.at}</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePreview}
                className="inline-flex size-8 items-center justify-center rounded-control text-primary transition hover:bg-accent-soft focus:outline-none focus:ring-2 focus:ring-primary/20"
                title="Preview"
                aria-label="Preview"
              >
                <Eye className="size-4" />
              </button>
              {canEdit ? (
                <>
                  <button
                    type="button"
                    onClick={openPicker}
                    className="inline-flex size-8 items-center justify-center rounded-control text-primary transition hover:bg-accent-soft focus:outline-none focus:ring-2 focus:ring-primary/20"
                    title="Replace"
                    aria-label="Replace"
                  >
                    <RefreshCw className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={onRemove}
                    className="inline-flex size-8 items-center justify-center rounded-control text-danger-ink transition hover:bg-danger-soft focus:outline-none focus:ring-2 focus:ring-danger/20"
                    title="Remove"
                    aria-label="Remove"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </>
              ) : null}
            </div>
          </div>
        ) : canEdit ? (
          <>
            <button
              type="button"
              onClick={openPicker}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                accept(e.dataTransfer.files?.[0]);
              }}
              className={`flex w-full items-center gap-3 rounded-card border border-dashed px-3 py-3 text-left transition ${
                dragOver ? "border-primary bg-accent-soft/60" : "border-border bg-sunken/40 hover:border-primary hover:bg-accent-soft/40"
              }`}
            >
              <Upload className="size-4 shrink-0 text-subdued" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block truncate text-small font-medium text-text">Upload “{doc.name}” here</span>
                <span className="block text-micro text-subdued">
                  Drag &amp; drop or <span className="font-semibold text-primary">browse</span> · PDF or DOCX · max 25 MB · one file
                </span>
              </span>
            </button>
            {error ? <p className="mt-1 text-micro font-semibold text-danger-ink">{error}</p> : null}
          </>
        ) : (
          <div className="flex items-center gap-2 rounded-card border border-border bg-sunken/30 px-3 py-2.5 text-small text-subdued">
            <FileText className="size-4" aria-hidden="true" />
            Not uploaded yet
          </div>
        )}
      </div>

      {isPreviewOpen && file ? (
        <DocumentPreviewDialog
          doc={doc}
          file={file}
          onClose={() => setIsPreviewOpen(false)}
        />
      ) : null}
    </div>
  );
}

function detectFormat(name: string): "PDF" | "DOCX" | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "PDF";
  if (lower.endsWith(".docx") || lower.endsWith(".doc")) return "DOCX";
  return null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function nowStamp(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()} · ${hh}:${mm}`;
}

function formatSize(kb: number): string {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}
