import { AlertCircle, ArrowLeft, CheckCircle2, Info, Loader2, Lock, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getApiErrorMessage } from "../../../shared/api/apiError";
import { Identifier } from "../../../shared/ui/Identifier";
import { useAuthStore } from "../../auth/state/auth.store";
import { AppHeader } from "../../new-document/components/AppHeader";
import { AppSidebar } from "../../new-document/components/AppSidebar";
import { canEditCompanyInfo } from "../access";
import {
  FONT_STACKS,
  fetchLogoObjectUrl,
  getCompanyApproval,
  getCompanyInfo,
  updateCompanyInfo,
  uploadLogo,
  type CompanyApprovalState,
  type CompanyInfo,
} from "../api/company.api";
import { CompanyApprovalPanel } from "../components/CompanyApprovalPanel";
import { LetterheadPreview } from "../components/LetterheadPreview";
import { LogoDropzone } from "../components/LogoDropzone";
import { ReasonForChangeModal, type FieldChange } from "../components/ReasonForChangeModal";

const FONTS = Object.keys(FONT_STACKS);

interface FormState {
  company_name: string;
  address: string;
  font_name: string;
  font_size: string;
  line_spacing: string;
}

const EMPTY: FormState = {
  company_name: "",
  address: "",
  font_name: "",
  font_size: "",
  line_spacing: "",
};

const controlClass =
  "mt-1.5 h-[36px] w-full rounded-control border border-border-strong bg-surface px-3 text-small focus:border-primary focus:outline-none disabled:bg-sunken disabled:text-subdued";

export function CompanyInfoPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const canEdit = canEditCompanyInfo(user?.role);

  const [info, setInfo] = useState<CompanyInfo | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoNonce, setLogoNonce] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [reasonModal, setReasonModal] = useState<FieldChange[] | null>(null);
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [approval, setApproval] = useState<CompanyApprovalState | null>(null);
  const [isApprovalLoading, setIsApprovalLoading] = useState(true);

  const loadApproval = useCallback(async () => {
    setIsApprovalLoading(true);
    try {
      const nextAppr = await getCompanyApproval();
      setApproval(nextAppr);
    } catch {
      // Non-blocking fallback
    } finally {
      setIsApprovalLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const next = await getCompanyInfo();
      setInfo(next);
      setForm({
        company_name: next.company_name ?? "",
        address: next.address ?? "",
        font_name: next.font_name ?? "",
        font_size: next.font_size != null ? String(next.font_size) : "",
        line_spacing: next.line_spacing != null ? String(next.line_spacing) : "",
      });
      setError(null);
    } catch (caught) {
      setError(getApiErrorMessage(caught, "Could not load company info."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reloadAll = useCallback(async () => {
    await Promise.all([load(), loadApproval()]);
  }, [load, loadApproval]);

  useEffect(() => {
    void load();
    void loadApproval();
  }, [load, loadApproval]);

  useEffect(() => {
    if (!info?.has_logo) {
      setLogoUrl(null);
      return;
    }

    let objectUrl: string | null = null;
    void (async () => {
      objectUrl = await fetchLogoObjectUrl();
      setLogoUrl(objectUrl);
    })();

    return () => {
      if (objectUrl) window.URL.revokeObjectURL(objectUrl);
    };
  }, [info?.has_logo, logoNonce]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    if (!canEdit) return;
    setSaved(false);
    setForm((current) => ({ ...current, [key]: value }));
  }

  const onLogo = useCallback(async (file: File) => {
    if (!canEdit) return;

    setIsUploading(true);
    setError(null);
    try {
      setInfo(await uploadLogo(file));
      setLogoNonce((n) => n + 1);
      void loadApproval();
    } catch (caught) {
      setError(getApiErrorMessage(caught, "Could not upload the logo."));
    } finally {
      setIsUploading(false);
    }
  }, [canEdit, loadApproval]);

  // What changed vs what's saved — drives the reason-for-change diff.
  const changes = useMemo<FieldChange[]>(() => {
    if (!info) return [];

    const diffs: FieldChange[] = [];
    const add = (label: string, from: unknown, to: string) => {
      if (String(from ?? "") !== to) diffs.push({ label, from: String(from ?? ""), to });
    };

    add("Company name", info.company_name, form.company_name.trim());
    add("Address", info.address, form.address.trim());
    add("Font", info.font_name, form.font_name);
    add("Size", info.font_size, form.font_size);
    add("Line spacing", info.line_spacing, form.line_spacing);
    return diffs;
  }, [form, info]);

  const commit = useCallback(
    async (reason?: string) => {
      if (!canEdit) return;

      setIsSaving(true);
      setReasonError(null);
      setError(null);

      try {
        const next = await updateCompanyInfo({
          company_name: form.company_name.trim(),
          address: form.address.trim() || undefined,
          font_name: form.font_name || undefined,
          font_size: form.font_size ? Number(form.font_size) : undefined,
          line_spacing: form.line_spacing ? Number(form.line_spacing) : undefined,
          reason,
        });
        setInfo(next);
        setReasonModal(null);
        setSaved(true);
        void loadApproval();
      } catch (caught) {
        const message = getApiErrorMessage(caught, "Could not save company info.");
        if (reason !== undefined) {
          setReasonError(message);
        } else {
          setError(message);
        }
      } finally {
        setIsSaving(false);
      }
    },
    [canEdit, form, loadApproval],
  );

  function onSave() {
    if (!canEdit) return;

    // Editing an EFFECTIVE letterhead is a controlled change — show the reason modal.
    // First-time setup saves straight through.
    if (info?.is_effective && changes.length > 0) {
      setReasonModal(changes);
    } else {
      void commit();
    }
  }

  const isLocked =
    approval?.status?.toLowerCase() === "pending" ||
    approval?.status?.toLowerCase() === "submitted" ||
    approval?.status?.toLowerCase() === "in_review";
  const canEditForm = canEdit && !isLocked;

  const nameMissing = !form.company_name.trim();
  const canSave = canEditForm && !nameMissing && !isUploading && !isSaving;

  return (
    <div className="min-h-screen bg-background text-text">
      <AppHeader user={user} unit={user?.unitId ? { id: user.unitId } : null} />

      <div className="lg:grid lg:h-[calc(100vh-var(--topbar-h))] lg:grid-cols-[var(--sidebar-w)_minmax(0,1fr)] lg:overflow-hidden">
        <AppSidebar user={user} />

        <main className="min-w-0 min-h-0 p-4 lg:p-6 lg:h-full lg:overflow-y-auto">
          <div className="mx-auto max-w-4xl space-y-5">
            <header>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="mb-2 inline-flex items-center gap-1.5 text-small font-semibold text-primary transition hover:text-primary-dark"
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                Back
              </button>
              <h1 className="text-h1 font-semibold tracking-tight">Company standard info</h1>
              <p className="mt-1 text-small text-subdued">
                The letterhead and formatting every generated document uses.
              </p>
            </header>

            {info && !info.is_complete ? (
              <div className="flex items-start gap-2 rounded-card border border-border bg-sunken p-4">
                <Info className="mt-0.5 size-4 shrink-0 text-subdued" aria-hidden="true" />
                <p className="text-small text-subdued">
                  No document can be generated until this is complete
                  {info.missing.length > 0 ? (
                    <>
                      {" — still needed: "}
                      <span className="font-semibold text-text">{info.missing.join(", ")}</span>
                    </>
                  ) : null}
                  .
                </p>
              </div>
            ) : null}

            {!canEdit ? (
              <div className="flex items-start gap-2 rounded-card border border-border bg-sunken p-4">
                <Lock className="mt-0.5 size-4 shrink-0 text-subdued" aria-hidden="true" />
                <p className="text-small text-subdued">
                  Read-only. Only a Reviewer QA user can add or edit company standard info.
                </p>
              </div>
            ) : null}

            {error ? (
              <div className="flex items-start gap-2 rounded-card border border-danger/30 bg-danger-soft p-4">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
                <p className="text-small text-danger">{error}</p>
              </div>
            ) : null}

            {isLoading || !info ? (
              <div className="flex items-center justify-center gap-2 rounded-card border border-border bg-surface p-16 text-subdued">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                <span className="text-small">Loading…</span>
              </div>
            ) : (
              <div className="grid gap-5 lg:grid-cols-2">
                <section className="space-y-4 rounded-card border border-border bg-surface p-5">
                  <Field label="Company name" required>
                    <input
                      type="text"
                      value={form.company_name}
                      disabled={!canEditForm || isSaving}
                      onChange={(event) => set("company_name", event.target.value)}
                      placeholder="Acme Pharmaceuticals Pvt. Ltd."
                      className={controlClass}
                    />
                    <Help>Prints in the document header.</Help>
                  </Field>

                  <Field label="Address">
                    <textarea
                      rows={2}
                      value={form.address}
                      disabled={!canEditForm || isSaving}
                      onChange={(event) => set("address", event.target.value)}
                      className={controlClass}
                    />
                  </Field>

                  <Field label="Logo">
                    <LogoDropzone
                      hasLogo={info.has_logo}
                      logoUrl={logoUrl}
                      isUploading={isUploading}
                      disabled={!canEditForm}
                      onFile={(file) => void onLogo(file)}
                    />
                  </Field>

                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Font">
                      <select
                        value={form.font_name}
                        disabled={!canEditForm || isSaving}
                        onChange={(event) => set("font_name", event.target.value)}
                        className={controlClass}
                      >
                        <option value="">Default</option>
                        {FONTS.map((font) => (
                          <option key={font} value={font}>
                            {font}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Size (pt)">
                      <input
                        type="number"
                        min={8}
                        max={14}
                        step={0.5}
                        value={form.font_size}
                        disabled={!canEditForm || isSaving}
                        onChange={(event) => set("font_size", event.target.value)}
                        placeholder="11"
                        className={controlClass}
                      />
                    </Field>

                    <Field label="Line spacing">
                      <input
                        type="number"
                        min={1}
                        max={2}
                        step={0.05}
                        value={form.line_spacing}
                        disabled={!canEditForm || isSaving}
                        onChange={(event) => set("line_spacing", event.target.value)}
                        placeholder="1.5"
                        className={controlClass}
                      />
                    </Field>
                  </div>

                  <div className="flex items-center gap-2 rounded-control border border-border bg-sunken px-3 py-2 text-micro text-subdued">
                    <Lock className="size-3.5 shrink-0" aria-hidden="true" />
                    Advanced letterhead &amp; company details — not in this release
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="rounded-card border border-border bg-surface p-5">
                    <p className="mb-3 text-overline font-semibold uppercase tracking-overline text-subdued">
                      Letterhead preview
                    </p>
                    <LetterheadPreview
                      companyName={form.company_name}
                      address={form.address}
                      fontName={form.font_name}
                      fontSize={form.font_size ? Number(form.font_size) : null}
                      lineSpacing={form.line_spacing ? Number(form.line_spacing) : null}
                      logoUrl={logoUrl}
                    />
                  </div>

                  {canEdit ? (
                    <div className="flex items-center justify-between gap-3 rounded-card border border-border bg-surface p-4">
                      <div>
                        {info.updated_by ? (
                          <p className="text-micro text-subdued">
                            Last updated by <Identifier>{info.updated_by}</Identifier>
                            {info.updated_at
                              ? ` · ${new Date(info.updated_at).toLocaleString()}`
                              : null}
                          </p>
                        ) : (
                          <p className="text-micro text-subdued">No updates yet</p>
                        )}
                        {nameMissing ? (
                          <p className="text-micro text-draft-fg mt-0.5">
                            Add a company name to save.
                          </p>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-3">
                        {saved ? (
                          <span className="inline-flex items-center gap-1 text-small text-approved-fg font-medium">
                            <CheckCircle2 className="size-4" aria-hidden="true" />
                            Saved
                          </span>
                        ) : null}
                        <button
                          type="button"
                          onClick={onSave}
                          disabled={!canSave}
                          className="inline-flex h-[36px] items-center gap-2 rounded-control bg-primary px-4 text-small font-semibold text-white transition hover:bg-primary-dark disabled:opacity-50"
                        >
                          {isSaving ? (
                            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <Save className="size-4" aria-hidden="true" />
                          )}
                          Save
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {/* Approval section matching reference Pharma 1 */}
                  <CompanyApprovalPanel
                    approval={approval}
                    isLoading={isApprovalLoading}
                    isComplete={Boolean(info.is_complete)}
                    userRole={user?.role}
                    onReload={reloadAll}
                  />
                </section>
              </div>
            )}
          </div>
        </main>
      </div>

      {reasonModal ? (
        <ReasonForChangeModal
          changes={reasonModal}
          error={reasonError}
          onCancel={() => {
            setReasonModal(null);
            setReasonError(null);
          }}
          onConfirm={(reason) => commit(reason)}
        />
      ) : null}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className="text-small font-semibold">
        {label}
        {required ? <span className="ml-0.5 text-danger">*</span> : null}
      </span>
      {children}
    </div>
  );
}

function Help({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-micro text-subdued">{children}</p>;
}
