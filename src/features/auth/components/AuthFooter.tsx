import { Icon } from "../../../shared/ps/Icon";
import { InfoTip } from "../../../shared/ps/Tooltip";
import { ThemeToggle } from "../../../shared/ui/ThemeToggle";
import { useServerClock } from "../hooks/useServerClock";

export function AuthFooter() {
  const time = useServerClock();
  return (
    <footer className="flex items-center justify-between gap-3 px-1 text-[12.5px] leading-[18px] text-text-2">
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
        <span className="inline-flex items-center gap-1">
          <Icon name="shield" size={14} />
          <span>Authorised users only</span>
          <InfoTip label="About authorised use" text="Every sign-in and every failed attempt is recorded with your user ID and the time." />
        </span>
        <span className="inline-flex items-center gap-1">
          <Icon name="schedule" size={14} />
          <span className="tabular-nums">{time}</span>
          <InfoTip label="About the server time" text="Server time. Every record is stamped with this clock." />
        </span>
        <span className="inline-flex items-center gap-1">
          <span>Help</span>
          <InfoTip label="Help" icon="help" text="Release 2026.11.1. Need help? Ask your company admin." />
        </span>
      </div>
      <ThemeToggle />
    </footer>
  );
}
