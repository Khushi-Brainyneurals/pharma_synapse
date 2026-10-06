import { Eye, Lock, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../../auth/state/auth.store";
import { AppHeader } from "../../new-document/components/AppHeader";
import { AppSidebar } from "../../new-document/components/AppSidebar";
import { masterDataAccess } from "../access";
import {
  BATCH_DOCS,
  DOCUMENT_TYPE,
  STAGE_DOC_COUNT,
  STEP_GROUPS,
  STEPS,
  type StepKey,
} from "../model/setup.model";
import { useSetupStore } from "../state/setupStore";

/**
 * The chrome shared by every Master Data Setup step: app shell, breadcrumb, the
 * "STEP N OF 6" eyebrow + title, the six-step progress rail, and the role gate.
 *
 * The gate is the whole point of this screen family: only QA and the Approver may edit;
 * a preparer sees everything read-only; anyone else is refused.
 */
export function SetupShell({
  step,
  title,
  description,
  children,
}: {
  step: StepKey;
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
}) {
  const user = useAuthStore((state) => state.user);
  const access = masterDataAccess(user?.role);
  const activeGroup = STEP_GROUPS.find((g) => g.steps.includes(step));

  // Prepared-by has read-only rights to ALL of master data (spec §Master Data): they can
  // open every page and navigate the same two-group stepper, but every control is disabled.

  return (
    <div className="min-h-screen bg-background text-text">
      <AppHeader user={user} unit={user?.unitId ? { id: user.unitId } : null} title="Master data" />
      <div className="flex">
        <AppSidebar user={user} />
        <main className="min-w-0 flex-1 p-4 lg:p-6">
          {!access.canView ? (
            <AccessDenied />
          ) : (
            <div className="mx-auto max-w-6xl space-y-5">
              {/* eyebrow + title */}
              <header>
                <p className="text-micro font-semibold uppercase tracking-overline text-primary">
                  Master data · {activeGroup?.label ?? "Setup"}
                </p>
                <h1 className="mt-1 text-h1 font-semibold">{title}</h1>
                <p className="mt-1 max-w-3xl text-small text-subdued">{description}</p>
              </header>

              {/* The two-group (Static / Dependent) navigator — shown for editors and the
                  read-only preparer view alike, so navigation is the same everywhere. */}
              <Stepper current={step} />

              {/* role banners */}
              {!access.canEdit ? (
                <div className="flex items-start gap-2 rounded-panel border border-inreview-fg/30 bg-inreview-bg/50 p-3 text-small text-inreview-fg">
                  <Eye className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <p>
                    <strong>View only.</strong> As Prepared-by you can open every uploaded master and check its
                    content, but editing, uploading and approval are reserved for the QA reviewer and the Approver.
                  </p>
                </div>
              ) : access.canApprove ? (
                <div className="flex items-start gap-2 rounded-panel border border-approved-fg/30 bg-approved-bg/50 p-3 text-small text-approved-fg">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <p>
                    <strong>Approver.</strong> You can edit the set and sign it off. A rejection must state a reason;
                    nothing goes live until you approve.
                  </p>
                </div>
              ) : null}

              {children}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

/** Per-step completion counts, read live from the draft. */
function useStepMeta(): Record<StepKey, string> {
  const uploads = useSetupStore((s) => s.uploads);
  const batch = useSetupStore((s) => s.batchUploads);
  const equipment = useSetupStore((s) => s.equipment);
  const instrument = useSetupStore((s) => s.instrument);

  const stageDone = Object.values(uploads).filter(Boolean).length;
  const batchDone = Object.values(batch).filter(Boolean).length;
  const equipDone = equipment.filter((r) => r.name.trim() && r.mcId.trim()).length;
  const instrDone = instrument.filter((r) => r.name.trim() && r.instrumentId.trim()).length;
  const totalUploaded = stageDone + batchDone;

  return {
    type: DOCUMENT_TYPE.label,
    stages: `${stageDone} / ${STAGE_DOC_COUNT}`,
    equipment: `${equipDone} / ${equipment.length}`,
    instruments: `${instrDone} / ${instrument.length}`,
    batch: `${batchDone} / ${BATCH_DOCS.length}`,
    preview: `${totalUploaded} documents`,
    company: "Letterhead & logo",
  };
}

/**
 * The two-sub-screen navigator: a "Static data" group (company + the equipment / instrument
 * masters) and a "Dependent data" group (the Type-keyed document formats + preview). Every
 * step is a direct link — a preparer navigates freely too, read-only.
 */
function Stepper({ current }: { current: StepKey }) {
  const meta = useStepMeta();

  return (
    <div className="flex flex-col gap-3 rounded-panel border border-border bg-surface p-3 lg:flex-row lg:items-stretch">
      {STEP_GROUPS.map((group, gi) => (
        <div
          key={group.key}
          className={`flex-1 ${gi > 0 ? "border-t border-border pt-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0" : ""}`}
        >
          <p className="mb-2 px-1.5 text-micro font-bold uppercase tracking-overline text-subdued">
            {group.label}
          </p>
          <ol className="flex flex-wrap items-center gap-1">
            {group.steps.map((key, i) => {
              const s = STEPS.find((x) => x.key === key);
              if (!s) return null;
              const active = key === current;
              return (
                <li key={key}>
                  <Link
                    to={s.route}
                    className={`flex items-center gap-2 whitespace-nowrap rounded-control px-2 py-1 transition hover:bg-sunken ${
                      active ? "bg-accent-soft" : ""
                    }`}
                  >
                    <span
                      className={`flex size-6 shrink-0 items-center justify-center rounded-full border text-micro font-bold ${
                        active
                          ? "border-primary bg-primary text-white"
                          : "border-border bg-surface text-subdued"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="flex flex-col leading-tight">
                      <span className={`text-small font-medium ${active ? "text-text" : "text-subdued"}`}>
                        {s.label}
                      </span>
                      <span className="font-mono text-[10px] tabular-nums text-subdued">{meta[key]}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="mx-8 flex max-w-lg flex-col items-center gap-3 rounded-panel border border-border bg-surface p-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger-ink">
        <Lock className="size-6" aria-hidden="true" />
      </span>
      <h1 className="text-h2 font-semibold">Master data isn't available to your role</h1>
      <p className="max-w-sm text-small text-subdued">
        Master-data setup is limited to the QA reviewer (upload &amp; edit) and the Approver (upload, edit &amp;
        sign-off). Prepared-by can view it read-only. Your role has no master-data access.
      </p>
    </div>
  );
}
