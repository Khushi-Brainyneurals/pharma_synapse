/** PharmaSynapse lockup. The reversed artwork shows in the navy theme. */
export function Logo({ width }: { width: number }) {
  return (
    <span className="flex flex-none items-center">
      <img src="/pharmasynapse-lockup.svg" alt="PharmaSynapse" className="h-auto max-w-full flex-none dark:hidden" style={{ width }} />
      <img src="/pharmasynapse-lockup-reversed.svg" alt="PharmaSynapse" className="hidden h-auto max-w-full flex-none dark:block" style={{ width }} />
    </span>
  );
}
