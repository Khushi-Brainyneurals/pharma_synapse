import { AlertCircle, FileText, Loader2, FileUp, X } from "lucide-react";
import { useId, useState, type ChangeEvent, type DragEvent } from "react";
import { FormError } from "../../../shared/ui/FormError";

export type FileUploadStatus = "idle" | "uploading" | "attached" | "failed" | "locked";

interface FileUploadCardProps {
  label: string;
  description: string;
  file: File | null;
  error?: string;
  isRequired?: boolean;
  disabled?: boolean;
  status?: FileUploadStatus;
  progress?: number;
  helperText?: string;
  accept?: string[];
  maxBytes?: number;
  onRetry?: () => void;
  onChange: (file: File | null) => void;
}

export function FileUploadCard({
  label,
  description,
  file,
  error,
  isRequired = false,
  disabled = false,
  status = file ? "attached" : "idle",
  progress = 100,
  helperText,
  accept = ["application/pdf"],
  maxBytes,
  onRetry,
  onChange,
}: FileUploadCardProps) {
  const inputId = useId();
  const errorId = error ? `${inputId}-error` : undefined;
  const helperId = helperText ? `${inputId}-helper` : undefined;
  const [isDragging, setIsDragging] = useState(false);
  const isBusy = status === "uploading";
  const isLocked = disabled || status === "locked" || isBusy;
  const describedBy = [errorId, helperId].filter(Boolean).join(" ") || undefined;

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange(event.target.files?.[0] ?? null);
    event.target.value = "";
  }

  function handleDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();

    if (isLocked) {
      return;
    }

    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);

    if (isLocked) {
      return;
    }

    onChange(event.dataTransfer.files?.[0] ?? null);
  }

  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="block text-sm font-semibold text-text">
        {label}
        {isRequired ? <span className="ml-1 text-danger">*</span> : null}
      </label>

      <label
        htmlFor={inputId}
        className={`block rounded-control border shadow-sm transition ${
          isLocked
            ? "cursor-not-allowed opacity-70"
            : "cursor-pointer hover:border-primary/60 hover:bg-accent-soft/30"
        } ${
          error
            ? "border-danger bg-danger-soft text-danger-ink"
            : status === "failed"
              ? "border-danger bg-danger-soft text-danger-ink"
              : file || isDragging
                ? "border-primary/45 bg-accent-soft/30"
                : "border-border bg-muted"
        } ${file || status === "failed" ? "p-3" : "border-dashed p-5 text-center"}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          id={inputId}
          type="file"
          accept={accept.join(",")}
          className="sr-only"
          disabled={isLocked}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          onChange={handleChange}
        />

        {status === "failed" ? (
          <span className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-small font-semibold text-danger-ink">
                {file?.name ?? "Upload failed"} - upload interrupted
              </span>
              <span className="mt-1 block text-small text-danger-ink">
                Upload did not finish - the connection dropped. Your other entries are saved.
              </span>
              {onRetry ? (
                <button
                  type="button"
                  className="mt-3 inline-flex min-h-9 items-center rounded-control border border-primary bg-white px-4 text-small font-semibold text-primary-dark transition hover:bg-accent-soft focus:outline-none focus:ring-2 focus:ring-primary/30"
                  onClick={onRetry}
                >
                  Retry upload
                </button>
              ) : null}
            </span>
          </span>
        ) : file ? (
          <span className="flex items-center gap-3 text-left">
            <span
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-control text-subdued"
              aria-hidden="true"
            >
              <FileText className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-small font-medium text-text">{file.name}</span>
              <span className="mt-1 block text-micro font-medium text-subdued">
                {status === "uploading"
                  ? `Uploading... ${formatFileSize(file.size)}`
                  : `${formatFileSize(file.size)} - ${
                      status === "locked" ? "locked" : "attached"
                    }`}
              </span>
              {status === "uploading" ? (
                <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.min(100, Math.max(8, progress))}%` }}
                  />
                </span>
              ) : null}
            </span>
            {status === "uploading" ? (
              <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
            ) : status === "locked" ? (
              <span className="text-micro font-semibold text-subdued">Lock</span>
            ) : (
              <button
                type="button"
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-control text-subdued transition hover:bg-muted hover:text-text focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed"
                disabled={disabled}
                onClick={(event) => {
                  event.preventDefault();
                  onChange(null);
                }}
                aria-label={`Remove ${label}`}
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            )}
          </span>
        ) : (
          <span className="flex flex-col items-center gap-2">
            <span
              className={`inline-flex size-8 items-center justify-center rounded-control ${
                error ? "text-danger" : "text-subdued"
              }`}
              aria-hidden="true"
            >
              <FileUp className="size-5" />
            </span>
            <span className="text-small leading-5 text-subdued">
              Drag a file here, or <span className="font-semibold text-primary-dark">browse</span>
            </span>
            <span className="text-micro font-medium text-subdued">
              {formatAcceptedTypes(accept)}
              {maxBytes ? ` - max ${formatFileSize(maxBytes)}` : ""}
            </span>
          </span>
        )}
      </label>

      {helperText ? (
        <p id={helperId} className="text-micro leading-5 text-subdued">
          {helperText}
        </p>
      ) : (
        <p className="text-micro leading-5 text-subdued">{description}</p>
      )}
      <FormError id={errorId} message={error} />
    </div>
  );
}

function formatAcceptedTypes(accept: string[]) {
  if (accept.includes("application/pdf")) {
    return "PDF";
  }

  return accept.join(", ");
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "PDF";
  }

  const mb = bytes / (1024 * 1024);
  if (mb >= 1) {
    return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
