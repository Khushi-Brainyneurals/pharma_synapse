import { AlertCircle, Loader2, Replace, Upload } from "lucide-react";
import { useState } from "react";

const MAX_BYTES = 2 * 1024 * 1024;
// Below this, the design warns the logo will look blurry in print.
const MIN_PRINT_WIDTH = 300;

interface LogoDropzoneProps {
  hasLogo: boolean;
  logoUrl: string | null;
  isUploading: boolean;
  disabled?: boolean;
  onFile: (file: File) => void;
}

/**
 * PNG logo upload — screen #10.
 *
 * Two failure registers, kept distinct as the design does:
 *   blocking (danger)  — wrong type, or oversize. The file is refused.
 *   advisory (neutral) — low resolution. Accepted, but flagged as "may look blurry in
 *                        print". Not an error, because a low-res logo is still a valid
 *                        letterhead — the QA reviewer should decide, not the form.
 */
export function LogoDropzone({
  hasLogo,
  logoUrl,
  isUploading,
  disabled = false,
  onFile,
}: LogoDropzoneProps) {
  const [error, setError] = useState<string | null>(null);
  const [advisory, setAdvisory] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  function validateAndSend(file: File) {
    if (disabled) return;

    setError(null);
    setAdvisory(null);

    // Content, not extension — a renamed JPEG must not slip through.
    if (file.type !== "image/png") {
      setError("The logo must be a PNG. Re-select a .png file.");
      return;
    }

    if (file.size > MAX_BYTES) {
      const mb = (file.size / 1024 / 1024).toFixed(1);
      setError(`Logo is ${mb} MB — over the 2 MB limit. Use a smaller PNG.`);
      return;
    }

    // Resolution is advisory only. Read it, warn, but still upload.
    const image = new Image();
    image.onload = () => {
      if (image.width < MIN_PRINT_WIDTH) {
        setAdvisory(
          `This logo is ${image.width}px wide and may look blurry in print (below ${MIN_PRINT_WIDTH}px).`,
        );
      }
      window.URL.revokeObjectURL(image.src);
    };
    image.src = window.URL.createObjectURL(file);

    onFile(file);
  }

  return (
    <div>
      <label
        onDragOver={(event) => {
          event.preventDefault();
          if (disabled) return;
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          if (disabled) return;
          const file = event.dataTransfer.files?.[0];
          if (file) validateAndSend(file);
        }}
        aria-disabled={disabled}
        className={`flex flex-col items-center justify-center gap-2 rounded-card border border-dashed p-6 text-center transition ${
          disabled
            ? "cursor-not-allowed border-border bg-sunken opacity-70"
            : isDragging
              ? "cursor-pointer border-primary bg-accent-soft"
              : "cursor-pointer border-border-strong bg-sunken hover:bg-sunken/70"
        }`}
      >
        {isUploading ? (
          <>
            <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
            <p className="text-small text-subdued">Processing…</p>
            <p className="text-micro text-subdued">
              Save is disabled while the logo is processing.
            </p>
          </>
        ) : hasLogo && logoUrl ? (
          <>
            <img
              src={logoUrl}
              alt="Current logo"
              className="h-12 rounded border border-border bg-white object-contain p-1"
            />
            <span className="inline-flex items-center gap-1.5 text-small font-semibold text-primary-dark">
              <Replace className="size-4" aria-hidden="true" />
              Replace
            </span>
          </>
        ) : (
          <>
            <Upload className="size-6 text-subdued" aria-hidden="true" />
            <p className="text-small">
              Drag a PNG here, or <span className="font-semibold text-primary-dark">browse</span>
            </p>
            <p className="font-mono text-micro text-subdued">PNG · max 2 MB</p>
          </>
        )}

        <input
          type="file"
          accept="image/png"
          disabled={disabled}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) validateAndSend(file);
          }}
        />
      </label>

      {error ? (
        <p className="mt-2 flex items-center gap-1.5 text-small text-danger">
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}

      {advisory ? (
        <p className="mt-2 flex items-center gap-1.5 rounded-control border border-border bg-sunken px-3 py-2 text-small text-subdued">
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          {advisory}
        </p>
      ) : null}
    </div>
  );
}
