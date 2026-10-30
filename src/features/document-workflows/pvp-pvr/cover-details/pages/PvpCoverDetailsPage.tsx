import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { AppHeader } from "../../../../../app/layout/AppHeader";
import { AppSidebar } from "../../../../../app/layout/AppSidebar";
import {
  getApiErrorMessage,
  isGenerationInProgressError,
} from "../../../../../shared/api/apiError";
import { useAuthStore } from "../../../../auth/state/auth.store";
import { CoverBomDocument } from "../../../bmr-bpr/bom/components/CoverBomDocument";
import {
  generateBom,
  getCoverBomDocx,
  getCoverGenerationProgress,
} from "../../../bmr-bpr/bom/api/bom.api";
import type {
  CoverPreviewFile,
  GenerateCoverProgress,
} from "../../../bmr-bpr/bom/api/bom.types";
import {
  getPvpBasicDetails,
  updatePvpBasicDetails,
  type PvpBasicDetails,
  type PvpBasicDetailsSection,
} from "../api/basicDetails.api";
import { DocumentStepper } from "../../../selection/components/DocumentStepper";
import { SelectionStrip } from "../../../selection/components/SelectionStrip";
import { useDocument } from "../../../selection/hooks/useDocument";
import { useDocumentSelectorData } from "../../../selection/hooks/useDocumentSelectorData";
import { useStepNavigation } from "../../../selection/hooks/useStepNavigation";
import { PVP_PVR_DOCUMENT_STEPS } from "../../../selection/model/documentSelector.config";
import { Plus, Trash, X } from "lucide-react";

type Tab = "cover" | "details";
const POLL_INTERVAL_MS = 4000;

export function PvpCoverDetailsPage() {
  const { documentId = "" } = useParams();
  const location = useLocation();
  const startGenerationImmediately =
    (location.state as { startGeneration?: boolean } | null)?.startGeneration === true;
  const shouldStartImmediatelyRef = useRef(startGenerationImmediately);
  const user = useAuthStore((state) => state.user);
  const { context, isLoading: isLoadingContext } = useDocumentSelectorData(user);
  const { document, isLoading: isLoadingDocument } = useDocument(documentId);
  const { goToStep } = useStepNavigation(documentId);
  const [tab, setTab] = useState<Tab>("cover");
  const [preview, setPreview] = useState<CoverPreviewFile | null>(null);
  const [progress, setProgress] = useState<GenerateCoverProgress | null>(null);
  const [isGenerating, setIsGenerating] = useState(true);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [details, setDetails] = useState<PvpBasicDetails | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(true);
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [initialDetails, setInitialDetails] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const isDirty =
    details !== null &&
    initialDetails !== null &&
    serialize(details) !== initialDetails;

  useEffect(() => {
    let cancelled = false;
    if (!documentId) return;
    setIsLoadingDetails(true);
    void getPvpBasicDetails(documentId)
      .then((result) => {
        if (!cancelled) {
          setDetails(result);
          setInitialDetails(serialize(result));
          setDetailsError(null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setDetailsError(
            getApiErrorMessage(error, "Unable to load PVP basic details."),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingDetails(false);
      });
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  const loadOrGenerateCover = useCallback(async () => {
    const skipPreviewCheck = shouldStartImmediatelyRef.current;
    shouldStartImmediatelyRef.current = false;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setIsGenerating(true);
    setCoverError(null);
    setPreview(null);
    setProgress(null);
    try {
      if (!skipPreviewCheck) {
        try {
          const existing = await getCoverBomDocx(documentId, controller.signal);
          if (!controller.signal.aborted) {
            setPreview(existing);
          }
          return;
        } catch (error) {
          if (controller.signal.aborted) return;
          if (!isNotFound(error)) throw error;
        }
      }

      try {
        await generateBom(documentId, controller.signal);
      } catch (error) {
        // Any 409 means an existing generation should be joined through polling.
        if (!isConflict(error) && !isGenerationInProgressError(error)) throw error;
      }
      while (!controller.signal.aborted) {
        const next = await getCoverGenerationProgress(documentId, controller.signal);
        setProgress(next);
        if (next.status === "error") {
          throw new Error(next.error || "Cover generation failed.");
        }
        if (next.status === "done") {
          const file = await getCoverBomDocx(documentId, controller.signal);
          if (!controller.signal.aborted) {
            setPreview(file);
          }
          return;
        }
        await delay(POLL_INTERVAL_MS, controller.signal);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setCoverError(
          getApiErrorMessage(error, "Unable to generate the cover page."),
        );
      }
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setIsGenerating(false);
      }
    }
  }, [documentId]);

  useEffect(() => {
    void loadOrGenerateCover();
    return () => {
      controllerRef.current?.abort();
      controllerRef.current = null;
    };
  }, [loadOrGenerateCover]);

  async function saveDetails() {
    if (!details || !isDirty || isSavingDetails) return;
    setIsSavingDetails(true);
    setDetailsError(null);
    setSaveMessage(null);
    try {
      const completeSections = details.sections.map((section) => {
        const { __isNew, ...rest } = section as Record<string, unknown>;
        void __isNew;
        return rest as PvpBasicDetailsSection;
      });
      const saved = await updatePvpBasicDetails(documentId, {
        data: { ...details.data },
        sections: completeSections,
      });
      setDetails(saved);
      setInitialDetails(serialize(saved));
      setSaveMessage("Basic details saved.");
    } catch (error) {
      setDetailsError(getApiErrorMessage(error, "Unable to save PVP basic details."));
    } finally {
      setIsSavingDetails(false);
    }
  }

  async function reloadBasicDetails() {
    setIsLoadingDetails(true);
    try {
      const result = await getPvpBasicDetails(documentId);
      setDetails(result);
      setInitialDetails(serialize(result));
      setDetailsError(null);
    } catch (error) {
      setDetailsError(
        getApiErrorMessage(error, "Unable to load PVP basic details."),
      );
    } finally {
      setIsLoadingDetails(false);
    }
  }

  function removeSection(sectionIndex: number) {
    setDetails((current) => {
      if (!current) return current;

      return {
        ...current,
        sections: current.sections.filter((_, index) => index !== sectionIndex),
      };
    });
  }

  function addSection() {
    setDetails((current) => {
      if (!current) return current;

      return {
        ...current,
        sections: [
          ...current.sections,
          {
            section_number: nextSectionNumber(current.sections),
            title: "New section",
            paragraphs: [],
            subheadings: [],
            __isNew: true,
          } as PvpBasicDetailsSection,
        ],
      };
    });
  }

  return (
    <div className="min-h-screen bg-background text-text">
      <AppHeader
        user={user}
        unit={context?.unit ?? null}
        isLoadingUnit={isLoadingContext}
      />
      <div
        className="lg:grid lg:h-[calc(100vh-var(--topbar-h))]
          lg:grid-cols-[var(--sidebar-w)_minmax(0,1fr)] lg:overflow-hidden"
      >
        <AppSidebar user={user} />
        <main className="min-w-0 lg:flex lg:h-full lg:flex-col lg:overflow-y-auto">
          <section className="mx-auto flex w-full flex-1 flex-col bg-surface shadow-sm lg:min-h-full">
            <div className="px-4 py-4 sm:px-6 lg:px-8">
              <DocumentStepper
                steps={PVP_PVR_DOCUMENT_STEPS}
                activeStepId="cover-details"
                onStepClick={goToStep}
              />
            </div>
            <SelectionStrip
              dosageForm={document?.dosage_form}
              docType={document?.doc_type}
              identifier={document?.bmr_number ?? document?.draft_id}
            />
            <div className="flex flex-1 flex-col">
              <div className="flex flex-col items-start justify-between border-b border-border p-5 pb-5">
                <p className="text-micro font-semibold uppercase tracking-overline text-primary">
                  Step 3 of 7
                </p>
                <h1 className="mt-1 text-h1 font-semibold">Cover &amp; basic details</h1>
              </div>
              <div
                className="grid grid-cols-2 gap-3 bg-muted/50 px-4 py-4 sm:px-6 lg:px-8"
                role="tablist"
                aria-label="Cover details"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "cover"}
                  onClick={() => setTab("cover")}
                  className={tabClass(tab === "cover")}
                >
                  Cover Page
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "details"}
                  onClick={() => setTab("details")}
                  className={tabClass(tab === "details")}
                >
                  Basic Details{isDirty ? " · Unsaved" : ""}
                </button>
              </div>

              {tab === "cover" ? (
                <div role="tabpanel" className="space-y-4 bg-muted/50 px-4 py-5 sm:px-6 lg:px-8">
                  {coverError ? (
                    <Alert
                      message={coverError}
                      action="Retry cover generation"
                      onClick={() => void loadOrGenerateCover()}
                    />
                  ) : null}
                  {isGenerating ? (
                    <CoverGenerationStatus progress={progress} />
                  ) : null}
                  {preview ? <CoverBomDocument file={preview} /> : null}
                  {!isGenerating && !coverError && !preview ? (
                    <p className="text-small text-subdued">
                      Cover preview is not available.
                    </p>
                  ) : null}
                </div>
              ) : (
                <div
                  role="tabpanel"
                  className="space-y-5 bg-muted/50 px-4 py-5 sm:px-6 lg:px-8"
                >
                  {detailsError ? (
                    <Alert
                      message={detailsError}
                      action="Reload basic details"
                      onClick={() => void reloadBasicDetails()}
                    />
                  ) : null}
                  {isLoadingDetails ? (
                    <p className="text-small text-subdued" role="status">
                      Loading basic details…
                    </p>
                  ) : null}
                  {!isLoadingDetails && details ? (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h2 className="text-h3 font-semibold">Document sections</h2>
                          <p className="mt-0.5 text-small text-subdued">
                            {details.sections.length}{" "}
                            {details.sections.length === 1 ? "section" : "sections"}
                          </p>
                        </div>
                        {isDirty ? (
                          <span
                            className="rounded-control border border-primary/20 bg-accent-soft
                              px-3 py-1 text-small font-medium text-primary-dark"
                          >
                            Unsaved changes
                          </span>
                        ) : null}
                      </div>

                      {details.sections.length ? (
                        <div className="space-y-5">
                          {details.sections.map((section, index) => (
                            <SectionEditor
                              key={"section-" + index}
                              section={section}
                              index={index}
                              disabled={isSavingDetails}
                              onChange={(next) => updateSection(setDetails, index, next)}
                              onDelete={() => removeSection(index)}
                            />
                          ))}
                        </div>
                      ) : (
                        <p
                          className="rounded-panel border border-border bg-surface
                            px-4 py-5 text-small text-subdued"
                        >
                          No sections were returned for this document.
                        </p>
                      )}

                      <button
                        type="button"
                        disabled={isSavingDetails}
                        className={addSectionButtonClass}
                        onClick={addSection}
                      >
                        <Plus className="h-4 w-4" />
                        Add section
                      </button>

                      {saveMessage ? (
                        <p className="text-small text-success" role="status">
                          {saveMessage}
                        </p>
                      ) : null}
                      <div className="flex justify-end border-t border-border pt-4">
                        <button
                          type="button"
                          disabled={!isDirty || isSavingDetails}
                          onClick={() => void saveDetails()}
                          className="rounded-control bg-primary px-5 py-2.5 text-small font-semibold
                            text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isSavingDetails ? "Saving…" : "Save basic details"}
                        </button>
                      </div>
                    </>
                  ) : null}
                </div>
              )}

              <div
                className="sticky bottom-0 z-10 mt-auto flex flex-col-reverse gap-3 border-t border-border
                  bg-surface p-3.5 shadow-auth sm:flex-row sm:justify-between"
              >
                <button
                  type="button"
                  className="rounded-control border border-border px-4 py-2 text-small
                    font-semibold text-subdued"
                  onClick={() => goToStep("select-document")}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="rounded-control bg-primary px-4 py-2 text-small font-semibold
                    text-white disabled:opacity-50"
                  disabled={isLoadingDocument || Boolean(detailsError)}
                  onClick={() => goToStep("process-bom")}
                >
                  Continue to process flow &amp; BOM
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function CoverGenerationStatus({
  progress,
}: {
  progress: GenerateCoverProgress | null;
}) {
  const percent = Math.max(2, Math.min(100, progress?.percent ?? 5));

  return (
    <div
      className="rounded-panel border border-border bg-muted p-6"
      role="status"
    >
      <p className="font-semibold">
        {progress?.step || "Loading or generating cover page…"}
      </p>
      <div className="mt-3 h-2 overflow-hidden rounded bg-border">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: percent + "%" }}
        />
      </div>
      <p className="mt-2 text-small text-subdued">
        {progress?.percent ?? 0}% complete
      </p>
    </div>
  );
}

function SectionEditor({
  section,
  index,
  disabled,
  onChange,
  onDelete,
}: {
  section: PvpBasicDetailsSection;
  index: number;
  disabled: boolean;
  onChange: (section: PvpBasicDetailsSection) => void;
  onDelete: () => void;
}) {
  const isNew = (section as Record<string, unknown>).__isNew === true;
  const numberKey = "number" in section && !("section_number" in section)
    ? "number"
    : "section_number";
  const paragraphs = Array.isArray(section.paragraphs)
    ? section.paragraphs
    : section.paragraphs == null
      ? []
      : [section.paragraphs];
  const subheadings = Array.isArray(section.subheadings)
    ? section.subheadings
    : [];
  const sectionNumber = section.section_number ?? section.number ?? index + 1;
  const titleKey =
    ["title", "section_title", "heading", "name"].find(
      (key) => key in section,
    ) ?? "title";

  function updateParagraph(paragraphIndex: number, text: string) {
    onChange({
      ...section,
      paragraphs: paragraphs.map((paragraph, index) =>
        index === paragraphIndex ? withNestedText(paragraph, text) : paragraph,
      ),
    });
  }

  function updateSubheadingTitle(subheadingIndex: number, text: string) {
    onChange({
      ...section,
      subheadings: subheadings.map((heading, index) =>
        index !== subheadingIndex
          ? heading
          : typeof heading === "string"
            ? text
            : isRecord(heading)
              ? { ...heading, title: text }
              : heading,
      ),
    });
  }

  function updateSubheadingValue(subheadingIndex: number, value: string) {
    onChange({
      ...section,
      subheadings: subheadings.map((heading, index) =>
        index === subheadingIndex ? value : heading,
      ),
    });
  }

  function updateSubheadingParagraph(
    subheadingIndex: number,
    paragraphIndex: number,
    text: string,
  ) {
    onChange({
      ...section,
      subheadings: subheadings.map((heading, headingIndex) => {
        if (headingIndex !== subheadingIndex || !isRecord(heading)) {
          return heading;
        }

        const headingParagraphs = Array.isArray(heading.paragraphs)
          ? heading.paragraphs
          : [];

        return {
          ...heading,
          paragraphs: headingParagraphs.map((paragraph, currentIndex) =>
            currentIndex === paragraphIndex
              ? withNestedText(paragraph, text)
              : paragraph,
          ),
        };
      }),
    });
  }

  return (
    <article className="overflow-hidden rounded-panel border border-border bg-surface shadow-sm">
      {/* Section header */}
      <header className="flex items-center gap-3 border-b border-border bg-muted px-4 py-3 sm:px-5">
        {isNew ? (
          <input
            type="number"
            min={1}
            aria-label="Section number"
            className="h-10 w-16 shrink-0 rounded-control border border-border bg-surface
              px-2 text-center text-small font-semibold text-primary-dark
              focus:border-primary/40 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            value={String(sectionNumber)}
            disabled={disabled}
            onChange={(event) =>
              onChange({
                ...section,
                [numberKey]:
                  event.target.value === "" ? "" : Number(event.target.value),
              })
            }
          />
        ) : (
          <span
            className="flex h-8 w-16 shrink-0 items-center justify-center rounded-full text-small font-semibold text-primary-dark"
          >
            Section {sectionNumber}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <input
            aria-label={"Section " + sectionNumber + " title"}
            placeholder="Section title"
            className="mt-1 block min-h-9 w-full rounded-control border border-border bg-surface
              px-3 py-1.5 text-small font-semibold text-text
              focus:border-primary/40 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            value={String(section[titleKey] ?? "")}
            disabled={disabled}
            onChange={(event) =>
              onChange({ ...section, [titleKey]: event.target.value })
            }
          />
        </div>
        <button
          type="button"
          disabled={disabled}
          aria-label={"Delete section " + sectionNumber}
          title="Delete section"
          className={removeButtonClass}
          onClick={onDelete}
        >
          <Trash className="h-3.5 w-3.5" />
        </button>
      </header>

      <div className="space-y-6 p-4 sm:p-5">
        {/* Paragraphs */}
        <div className="space-y-3">
          {paragraphs.map((paragraph, paragraphIndex) => (
            <div key={"paragraph-" + paragraphIndex} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-micro font-semibold uppercase tracking-overline text-subdued">
                  Paragraph {paragraphIndex + 1}
                </span>
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={"Remove paragraph " + (paragraphIndex + 1)}
                  className={removeButtonClass}
                  onClick={() =>
                    onChange({
                      ...section,
                      paragraphs: paragraphs.filter((_, index) => index !== paragraphIndex),
                    })
                  }
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <textarea
                placeholder="Enter paragraph…"
                className={textareaClass}
                value={nestedText(paragraph)}
                disabled={disabled}
                onChange={(event) =>
                  updateParagraph(paragraphIndex, event.target.value)
                }
              />
            </div>
          ))}
          <button
            type="button"
            disabled={disabled}
            className={addButtonClass}
            onClick={() =>
              onChange({ ...section, paragraphs: [...paragraphs, ""] })
            }
          >
            <Plus className="h-3.5 w-3.5" />
            Add paragraph
          </button>
        </div>

        {/* Subheadings */}
        {subheadings.length > 0 ? (
          <div className="space-y-3 border-t border-border pt-5">
            <h4 className="text-micro font-semibold uppercase tracking-overline text-subdued">
              Subheadings
            </h4>
            <div className="space-y-2.5">
              {subheadings.map((heading, headingIndex) => (
                <SubheadingEditor
                  key={"subheading-" + headingIndex}
                  heading={heading}
                  index={headingIndex}
                  disabled={disabled}
                  onStringChange={(value) =>
                    updateSubheadingValue(headingIndex, value)
                  }
                  onTitleChange={(text) =>
                    updateSubheadingTitle(headingIndex, text)
                  }
                  onParagraphChange={(paragraphIndex, text) =>
                    updateSubheadingParagraph(headingIndex, paragraphIndex, text)
                  }
                  onRemove={() =>
                    onChange({
                      ...section,
                      subheadings: subheadings.filter(
                        (_, index) => index !== headingIndex,
                      ),
                    })
                  }
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function SubheadingEditor({
  heading,
  index,
  disabled,
  onStringChange,
  onTitleChange,
  onParagraphChange,
  onRemove,
}: {
  heading: unknown;
  index: number;
  disabled: boolean;
  onStringChange: (value: string) => void;
  onTitleChange: (text: string) => void;
  onParagraphChange: (paragraphIndex: number, text: string) => void;
  onRemove: () => void;
}) {
  if (typeof heading === "string") {
    const { label, answer } = splitSubheading(heading);

    return (
      <div
        className="grid items-center gap-3 rounded-control border border-border
          px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]"
      >
        {label ? (
          <p className="text-small font-medium text-text">{label}</p>
        ) : (
          <input
            aria-label={"Subheading " + (index + 1) + " label"}
            className={inputClass(false)}
            placeholder="Subheading label"
            value={label}
            disabled={disabled}
            onChange={(event) =>
              onStringChange(formatSubheading(event.target.value, answer))
            }
          />
        )}
        <input
          aria-label={"Subheading " + (index + 1) + " response"}
          className={inputClass(false)}
          placeholder="Enter response…"
          value={answer}
          disabled={disabled}
          onChange={(event) =>
            onStringChange(formatSubheading(label, event.target.value))
          }
        />
        <button
          type="button"
          disabled={disabled}
          aria-label={"Remove subheading " + (index + 1)}
          className={removeButtonClass}
          onClick={onRemove}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  if (!isRecord(heading)) return null;

  const paragraphs = Array.isArray(heading.paragraphs)
    ? heading.paragraphs
    : [];
  const title = heading.title ?? heading.heading ?? heading.name ?? "";

  return (
    <div className="space-y-3 rounded-control border border-border bg-muted p-3 sm:p-4">
      <div className="flex items-center gap-2">
        <input
          aria-label={"Subheading " + (index + 1) + " title"}
          className="block min-h-10 w-full rounded-control border border-border bg-surface
            px-3 py-2 text-small font-semibold text-text"
          value={nestedText(title)}
          disabled={disabled}
          onChange={(event) => onTitleChange(event.target.value)}
        />
        <button
          type="button"
          disabled={disabled}
          aria-label={"Remove subheading " + (index + 1)}
          className={removeButtonClass}
          onClick={onRemove}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {paragraphs.map((paragraph, paragraphIndex) => (
        <textarea
          key={paragraphIndex}
          placeholder="Enter paragraph…"
          className={textareaClass}
          value={nestedText(paragraph)}
          disabled={disabled}
          onChange={(event) =>
            onParagraphChange(paragraphIndex, event.target.value)
          }
        />
      ))}
    </div>
  );
}

function Alert({
  message,
  action,
  onClick,
}: {
  message: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-control border border-danger/20 bg-danger-soft px-4 py-3 text-small text-danger-ink"
    >
      <p>{message}</p>
      <button
        type="button"
        onClick={onClick}
        className="mt-2 font-semibold underline"
      >
        {action}
      </button>
    </div>
  );
}

function updateSection(
  setter: React.Dispatch<React.SetStateAction<PvpBasicDetails | null>>,
  sectionIndex: number,
  section: PvpBasicDetailsSection,
) {
  setter((current) => {
    if (!current) return current;

    return {
      ...current,
      sections: current.sections.map((item, index) =>
        index === sectionIndex ? section : item,
      ),
    };
  });
}

function nextSectionNumber(sections: PvpBasicDetailsSection[]): number {
  const numbers = sections
    .map((section) => Number(section.section_number ?? section.number))
    .filter((number) => Number.isFinite(number));

  return numbers.length ? Math.max(...numbers) + 1 : sections.length + 1;
}

function nestedText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (isRecord(value)) {
    return String(value.text ?? value.content ?? value.paragraph ?? "");
  }

  return "";
}

function withNestedText(value: unknown, text: string): unknown {
  if (!isRecord(value)) return text;

  const key =
    "text" in value
      ? "text"
      : "content" in value
        ? "content"
        : "paragraph" in value
          ? "paragraph"
          : "text";

  return { ...value, [key]: text };
}

function splitSubheading(value: string): { label: string; answer: string } {
  const separator = value.indexOf(":");
  if (separator < 0) {
    return { label: value.trim(), answer: "" };
  }

  return {
    label: value.slice(0, separator).trim(),
    answer: value.slice(separator + 1).trimStart(),
  };
}

function formatSubheading(label: string, answer: string): string {
  const cleanLabel = label.trim();
  if (cleanLabel) return cleanLabel + ": " + answer;
  return answer ? ": " + answer : "";
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function serialize(value: PvpBasicDetails): string {
  return JSON.stringify(value);
}

function isNotFound(error: unknown): boolean {
  return statusOf(error) === 404;
}

function isConflict(error: unknown): boolean {
  return statusOf(error) === 409;
}

function statusOf(error: unknown): number | undefined {
  if (!isRecord(error) || !isRecord(error.response)) return undefined;
  return error.response.status as number | undefined;
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

function tabClass(active: boolean): string {
  const base = [
    "flex w-full items-center justify-center rounded-control border",
    "px-4 py-3 text-small font-semibold transition-colors",
  ].join(" ");
  const selected = "border-primary/25 bg-accent-soft text-primary-dark";
  const idle = "border-[#dce3e8] bg-white text-[#536273] hover:border-[#9acdcc]";

  return [base, active ? selected : idle].join(" ");
}

function inputClass(readOnly: boolean): string {
  const base =
    "block min-h-10 w-full rounded-control border border-border px-3 py-2 text-small font-normal";
  const state = readOnly ? "bg-muted text-subdued" : "bg-surface text-text";

  return [base, state].join(" ");
}

const textareaClass = [
  "block min-h-20 w-full resize-y rounded-control border border-border",
  "bg-surface px-3 py-2 text-small font-normal text-text",
  "focus:border-primary/40 focus:outline-none",
].join(" ");

const removeButtonClass = [
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-control",
  "border border-border bg-surface text-subdued transition-colors",
  "hover:border-danger/30 hover:bg-danger-soft hover:text-danger-ink",
  "disabled:cursor-not-allowed disabled:opacity-50",
].join(" ");

const addButtonClass = [
  "inline-flex items-center gap-1.5 rounded-control border border-primary-dark/30",
  "bg-surface px-3 py-1.5 text-[12px] font-semibold text-primary-dark transition-colors",
  "hover:bg-primary-dark hover:text-white",
  "disabled:cursor-not-allowed disabled:opacity-50",
].join(" ");

const addSectionButtonClass = [
  "flex w-full items-center justify-center gap-2 rounded-panel border border-dashed",
  "border-primary-dark/40 bg-surface px-4 py-3 text-small font-semibold text-primary-dark",
  "transition-colors hover:bg-accent-soft",
  "disabled:cursor-not-allowed disabled:opacity-50",
].join(" ");
