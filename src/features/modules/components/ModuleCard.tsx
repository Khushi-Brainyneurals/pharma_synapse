import { IconTile } from "../../../shared/ps/IconTile";
import type { AppModule } from "../model/modules";

interface ModuleCardProps {
  module: AppModule;
  onOpen: (module: AppModule) => void;
}

const clamp = (lines: number) => ({ display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical" as const, overflow: "hidden" });
const HIDE_PLANNED_BADGE = new Set([
  "MASTER_DATA_305",
  "ISSUANCE_102",
  "CPV_202",
  "APQR_203",
  "ASSET_COMPLIANCE_501",
]);

export function ModuleCard({ module, onOpen }: ModuleCardProps) {
  return (
    <button
      type="button"
      disabled={module.disabled}
      title={module.detail}
      aria-disabled={module.disabled}
      onClick={() => {
        if (!module.disabled) onOpen(module);
      }}
      className="box-border flex h-full cursor-pointer flex-col gap-4 overflow-hidden rounded-card border border-glass-rim bg-glass-card px-4 py-3 text-left shadow-glass-card backdrop-blur-glass backdrop-saturate-[1.6] transition-[border-color,box-shadow] duration-1 hover:border-primary dark:border-soft-edge dark:bg-card dark:shadow-raised dark:backdrop-blur-none dark:hover:border-primary disabled:cursor-not-allowed disabled:hover:border-glass-rim dark:disabled:hover:border-soft-edge"
    >
      <span className="flex items-center gap-2.5">
        <IconTile family={module.family} icon={module.icon} />
        <span className="min-w-0 flex-auto text-[14.5px] font-medium leading-5 text-text [text-wrap:pretty]" style={clamp(2)}>
          {module.name}
        </span>
        {module.status === "plan" && !HIDE_PLANNED_BADGE.has(module.key) ? (
          <span className="whitespace-nowrap rounded-full border border-border px-2 py-px font-mono text-[11px] font-medium uppercase leading-4 tracking-[0.08em] text-text-3">
            Planned
          </span>
        ) : null}
      </span>
      <span className="text-[12.5px] leading-[18px] text-text-2 [text-wrap:pretty]" style={clamp(2)}>
        {module.line}
      </span>
    </button>
  );
}
