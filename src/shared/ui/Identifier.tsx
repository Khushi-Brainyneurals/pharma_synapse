/**
 * Any identifier: document number, batch number, BMR no., version, user code, or a
 * measured CPP value.
 *
 * Design-system rule 4 — "Mono for every identifier": IBM Plex Mono with tabular
 * figures, so `0/O` and `1/l` can never be transcribed wrong. On a regulated record
 * that is a correctness requirement, not a stylistic one.
 */
export function Identifier({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`font-mono tabular-nums ${className}`}>{children}</span>
  );
}
