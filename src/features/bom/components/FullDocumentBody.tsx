import { useMemo } from "react";
import type { BomResponse } from "../api/bom.types";
import { calcContent } from "./BomCalcBody";
import { bomContent } from "./BomPageBody";
import { CoverPageBody } from "./CoverPageBody";
import { frontMatterContent } from "./FrontMatter";
import { mergeFlow, PaginatedBody } from "./PaginatedBody";
import { refBlocksToFlow, type RefDocBlock } from "./refFlow";
import stageBlocks from "../data/stageBlocks.json";

/**
 * The complete BMR as printed A4 sheets, in the reference's sequence: cover → INDEX /
 * precautions / signature log → 2.0 BOM + 2.1.1 calculation → 3.0 Dispensing … 7.0 Coating.
 * This is the page-7 preview a preparer builds; the reviewer reads the SAME rendering, so
 * both see identical pages. Flowed through the measured paginator (repeating header/footer,
 * never clipped).
 */
export function FullDocumentBody({ bom, headerInches }: { bom: BomResponse; headerInches: number }) {
  // Build the flow once per document. The measured paginator resets whenever the unit
  // list changes identity, so a fresh array on every render (e.g. while the review page
  // polls) would restart the 80+ sheet measurement and it would never settle.
  const content = useMemo(() => {
    const hasCalc = bom.ingredients.some((row) => row.is_api);
    const parts = [frontMatterContent(), bomContent(bom.ingredients, bom.formulation_notes)];
    if (hasCalc) parts.push(calcContent(bom.ingredients));
    parts.push(refBlocksToFlow(stageBlocks as unknown as RefDocBlock[], "stg"));
    return mergeFlow(...parts);
  }, [bom]);

  return (
    <PaginatedBody
      header={bom.header}
      headerInches={headerInches}
      cover={<CoverPageBody cover={bom.cover} />}
      content={content}
    />
  );
}
