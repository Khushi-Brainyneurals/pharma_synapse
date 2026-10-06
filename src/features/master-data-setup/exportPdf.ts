/**
 * Export a master-data list (equipment / instrument) as a PDF, client-side and with no
 * dependency: the live table is rendered into a hidden iframe and handed to the browser's
 * print engine ("Save as PDF"). The document carries the GMP stamp the design calls for —
 * title, date · time, who downloaded it, and a "uncontrolled copy when printed" footer.
 */
export function printListPdf({
  title,
  subtitle,
  columns,
  rows,
  by,
  landscape,
}: {
  title: string;
  subtitle: string;
  columns: string[];
  rows: string[][];
  by: string;
  landscape?: boolean;
}) {
  const now = new Date();
  const stamp = now.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  const filename = `${slug(title)}_${dateSlug(now)}`;

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(filename)}</title>
<style>
  @page { size: ${landscape ? "A4 landscape" : "A4"}; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #14161a; background: #fff; margin: 0; }
  .hd { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 2px solid #14161a; padding-bottom: 8px; margin-bottom: 12px; }
  .hd h1 { font-size: 15px; margin: 0; }
  .hd p { font-size: 10px; color: #5b6470; margin: 3px 0 0; }
  .meta { font-family: "IBM Plex Mono", ui-monospace, Menlo, monospace; font-size: 9px; color: #5b6470; text-align: right; white-space: nowrap; }
  table { width: 100%; border-collapse: collapse; font-size: 9px; }
  th, td { border: 0.5px solid #b9c0c9; padding: 4px 6px; text-align: left; vertical-align: top; }
  thead th { background: #eef1f4; font-size: 8px; text-transform: uppercase; letter-spacing: 0.4px; }
  tbody tr:nth-child(even) { background: #f7f8fa; }
  .ft { margin-top: 10px; font-size: 8px; color: #8a929c; display: flex; justify-content: space-between; }
</style></head>
<body>
  <div class="hd">
    <div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div>
    <div class="meta">Downloaded ${esc(stamp)}<br/>by ${esc(by)}</div>
  </div>
  <table>
    <thead><tr>${columns.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead>
    <tbody>${rows
      .map((r) => `<tr>${r.map((c) => `<td>${esc(c) || "&nbsp;"}</td>`).join("")}</tr>`)
      .join("")}</tbody>
  </table>
  <div class="ft"><span>Uncontrolled copy when printed</span><span>${esc(filename)}.pdf</span></div>
</body></html>`;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  // Give the iframe a tick to lay out before invoking the print dialog.
  window.setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    window.setTimeout(() => iframe.remove(), 800);
  }, 300);
}

function esc(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function dateSlug(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}`;
}
