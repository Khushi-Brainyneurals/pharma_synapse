import type { CoverPreviewFile } from "../api/bom.types";
import { DocxViewer } from "../../preview/components/DocxViewer";

export function CoverBomDocument({ file }: { file: CoverPreviewFile }) {
  return (
    <DocxViewer
      file={{ ...file, format: "docx" }}
      containerHeightClass="h-[calc(100vh-390px)] min-h-[420px]"
    />
  );
}
