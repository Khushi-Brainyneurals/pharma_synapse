import { Link } from "react-router-dom";
import { useAuthStore } from "../../auth/state/auth.store";
import type { DashboardItem } from "../api/dashboard.api";
import { formatLastModified, getDocumentAction } from "../components/DocumentCard";

/**
 * List (table) view of the dashboard documents.
 *
 * Uses the same `getDocumentAction` helper as `DocumentCard`, so a row always opens
 * the same step, with the same label, as the equivalent card.
 */

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-amber-100 text-amber-800",
  in_review: "bg-blue-100 text-blue-800",
  in_approval: "bg-purple-100 text-purple-800",
  approved_for_print: "bg-emerald-100 text-emerald-800",
  returned_for_correction: "bg-orange-100 text-orange-800",
  rejected: "bg-rose-100 text-rose-800",
};

function statusBadgeClass(item: DashboardItem): string {
  const key = item.bucket || item.status;
  return STATUS_BADGE[key] ?? "bg-muted text-subdued";
}

function splitLastModified(value?: string | null): { date: string; time: string } | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return {
    date: d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
  };
}

export function DocumentList({ items }: { items: DashboardItem[] }) {
  const username = useAuthStore((state) => state.user?.username);
  const userRole = useAuthStore((state) => state.user?.role);

  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface">
      <table className="w-full min-w-[860px] border-collapse text-left text-small">
        <thead>
          <tr className="border-b border-border bg-sunken text-micro font-semibold text-subdued">
            <th scope="col" className="px-4 py-3">Document</th>
            <th scope="col" className="px-4 py-3">Product</th>
            <th scope="col" className="px-4 py-3">Status</th>
            <th scope="col" className="px-4 py-3">Dosage form</th>
            <th scope="col" className="px-4 py-3">Status</th>
            <th scope="col" className="px-4 py-3">Last modified</th>
            <th scope="col" className="px-4 py-3 text-right">
              <span className="sr-only">Action</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const { target, action } = getDocumentAction(item, username, userRole);
            const modified = splitLastModified(item.last_modified_at);

            return (
              <tr
                key={item.document_id}
                className="border-b border-border last:border-b-0 transition hover:bg-accent-soft/30"
              >
                <td className="px-4 py-3 align-top">
                  <Link
                    to={target}
                    state={{ dashboardPermissions: item.permissions }}
                    className="font-semibold hover:text-primary-dark hover:underline"
                  >
                    {`${item.doc_type}_${item.document_id?.slice(0, 8) || ""}`}
                  </Link>
                  <div className="font-mono text-micro text-subdued">{item.version || "v00"}</div>
                </td>

                <td className="px-4 py-3 align-top">
                  <span className="break-words">{item.product_name ?? "Untitled document"}</span>
                  {item.note ? (
                    <div className="mt-0.5 max-w-[32ch] truncate text-micro text-subdued" title={item.note}>
                      {item.note}
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-3 align-top max-w-[122px]">
                    <span
                        className={`inline-block max-w-full whitespace-normal break-words rounded-full px-2.5 py-0.5 text-micro font-semibold ${statusBadgeClass(item)}`}
                    >
                        {item.bucket || item.status || "Draft"}
                    </span>
                </td>
                <td className="px-4 py-3 align-top text-subdued">{item.dosage_form || "-"}</td>

                <td className="px-4 py-3 align-top min-w-[120px]">
                  <span className="font-semibold text-primary-dark">
                    {item.state_label || item.status || "Draft"}
                  </span>
                  {item.is_overdue ? (
                    <div className="text-micro text-danger">
                      Overdue · {item.days_in_step} days in this step
                    </div>
                  ) : null}
                </td>

                <td className="whitespace-nowrap px-4 py-3 align-top text-micro text-subdued">
                {modified ? (
                    <>
                    <div>{modified.date}</div>
                    <div>{modified.time}</div>
                    </>
                ) : (
                    "—"
                )}
                </td>

                <td className="px-4 py-3 text-right align-top">
                  <Link
                    to={target}
                    state={{ dashboardPermissions: item.permissions }}
                    className="inline-flex h-8 items-center whitespace-nowrap rounded-control border border-primary px-3 text-small font-semibold text-primary-dark transition hover:bg-primary-dark hover:text-white"
                  >
                    {action}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
