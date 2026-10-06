import { httpClient } from "../../../shared/api/httpClient";

export interface FormatPreviewFile {
  blob: Blob;
  filename: string;
  format: "pdf" | "docx";
}

export class InvalidFormatPreviewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidFormatPreviewError";
  }
}

export async function getFormatPreview(documentId: string): Promise<FormatPreviewFile> {
  const response = await httpClient.get(
    `/api/documents/${encodeURIComponent(documentId)}/format-preview`,
    {
      responseType: "blob",
      headers: {
        Accept:
          "application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    },
  );

  const blob = response.data as Blob;
  const format = await detectPreviewFormat(blob);
  if (!format) {
    const contentType = response.headers["content-type"] || blob.type || "an unknown content type";
    throw new InvalidFormatPreviewError(
      `The format-preview endpoint returned an unsupported or corrupted ${contentType} file.`,
    );
  }

  return {
    blob,
    format,
    filename: ensureExtension(
      getResponseFilename(response.headers["content-disposition"]) ??
        `format_preview_${documentId}.${format}`,
      format,
    ),
  };
}

async function detectPreviewFormat(blob: Blob): Promise<"pdf" | "docx" | null> {
  const signature = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
  const text = String.fromCharCode(...signature);
  if (text === "%PDF-") return "pdf";
  if (signature[0] === 0x50 && signature[1] === 0x4b) return "docx";
  return null;
}

function ensureExtension(filename: string, format: "pdf" | "docx"): string {
  return filename.toLowerCase().endsWith(`.${format}`)
    ? filename
    : `${filename.replace(/\.[^.]+$/, "")}.${format}`;
}

function getResponseFilename(contentDisposition: unknown): string | null {
  if (typeof contentDisposition !== "string") return null;

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  const regularMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  const encodedFilename = utf8Match?.[1] ?? regularMatch?.[1];

  if (!encodedFilename) return null;

  try {
    return decodeURIComponent(encodedFilename.trim());
  } catch {
    return encodedFilename.trim();
  }
}
