export function Spinner({ label }: { label: string }) {
  return (
    <span
      role="status"
      aria-label={label}
      className="inline-block size-[18px] flex-none animate-spin rounded-full border-2 border-current border-t-transparent opacity-80"
    />
  );
}
